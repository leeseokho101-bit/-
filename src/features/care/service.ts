import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { evaluateAlerts, type AlertKind } from "@/domain/glp1/alerts";
import {
  lowEvents,
  mealResponse,
  type GlucosePoint,
  type MealResponse,
} from "@/domain/glp1/cgm";
import { getDrug, type DrugInfo } from "@/domain/glp1/drugs";
import {
  doseSchedule,
  isMissedAlert,
  missedDoseCount,
  MISSED_WINDOW_DAYS,
  type DoseRecord,
  type InjectionSite,
} from "@/domain/glp1/dosing";
import {
  mealTotals,
  parseMealItems,
  type MealItem,
  type MealType,
} from "@/domain/glp1/meal";
import {
  parseRedFlags,
  parseSymptoms,
  triageCheckIn,
  type RedFlagCode,
  type SymptomScores,
  type TriageLevel,
} from "@/domain/glp1/symptoms";
import {
  addDaysIso,
  DAY_MS,
  HOUR_MS,
  kstDateTime,
  kstDayStart,
} from "@/domain/glp1/time";
import { CARE_CONSENT_VERSION } from "@/content/care";
import type {
  CheckInFormData,
  DoseFormData,
  EnrollFormData,
  MealFormData,
} from "./schemas";

type Db = PrismaClient | Prisma.TransactionClient;

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

// ─── 등록 ───

export type Enrollment = {
  drug: DrugInfo;
  doseMg: number;
  doseSince: string;
  startDate: string;
  clinic: { name: string; code: string } | null;
  shareWithClinic: boolean;
  allowResearch: boolean;
  allowPharmaStats: boolean;
  /** 의원이 정한 다음 내원 예정일 */
  nextVisitOn: string | null;
  /** 환자가 기록한 치료 중단 */
  stopped: { date: string; reason: StopReasonCode } | null;
};

export const STOP_REASONS = [
  "SIDE_EFFECTS",
  "COST",
  "INCONVENIENCE",
  "GOAL_REACHED",
  "DOCTOR_ADVICE",
  "OTHER",
] as const;
export type StopReasonCode = (typeof STOP_REASONS)[number];

export async function getEnrollment(
  db: Db,
  userId: string,
): Promise<Enrollment | null> {
  const row = await db.careEnrollment.findUnique({
    where: { userId },
    include: { clinic: { select: { name: true, code: true } } },
  });
  const drug = row && getDrug(row.drugCode);
  if (!row || !drug) return null;
  return {
    drug,
    doseMg: Number(row.currentDoseMg),
    doseSince: isoOf(row.doseSince),
    startDate: isoOf(row.startDate),
    clinic: row.clinic,
    shareWithClinic: row.shareWithClinic,
    allowResearch: row.allowResearch,
    allowPharmaStats: row.allowPharmaStats,
    nextVisitOn: row.nextVisitOn ? isoOf(row.nextVisitOn) : null,
    stopped:
      row.stoppedAt && row.stopReason
        ? { date: isoOf(row.stoppedAt), reason: row.stopReason }
        : null,
  };
}

/**
 * 등록·설정 저장. 연결 코드가 있으면 의원을 찾아 연결한다 (없는 코드면 "no-clinic").
 * 약이나 용량이 바뀌면 그날부터 새 용량으로 본다.
 */
export async function saveEnrollment(
  db: Db,
  userId: string,
  data: EnrollFormData,
  today: string,
): Promise<"saved" | "no-clinic"> {
  let clinicId: string | null = null;
  if (data.clinicCode) {
    const clinic = await db.clinic.findUnique({
      where: { code: data.clinicCode },
      select: { id: true },
    });
    if (!clinic) return "no-clinic";
    clinicId = clinic.id;
  }
  const prev = await db.careEnrollment.findUnique({ where: { userId } });
  const doseChanged =
    !prev ||
    prev.drugCode !== data.drugCode ||
    Number(prev.currentDoseMg) !== data.doseMg;
  const row = {
    clinicId,
    linkedAt: clinicId
      ? prev?.clinicId === clinicId
        ? prev.linkedAt
        : new Date()
      : null,
    drugCode: data.drugCode,
    currentDoseMg: data.doseMg,
    doseSince: doseChanged
      ? dateOf(prev ? today : data.startDate)
      : prev.doseSince,
    startDate: dateOf(data.startDate),
    consentVersion: CARE_CONSENT_VERSION,
    consentAt: new Date(),
    shareWithClinic: data.shareWithClinic,
    allowResearch: data.allowResearch,
    allowPharmaStats: data.allowPharmaStats,
  };
  await db.careEnrollment.upsert({
    where: { userId },
    create: { userId, ...row },
    update: row,
  });
  return "saved";
}

export async function saveCurrentDose(
  db: Db,
  userId: string,
  data: { doseMg: number; doseSince: string },
): Promise<void> {
  await db.careEnrollment.update({
    where: { userId },
    data: { currentDoseMg: data.doseMg, doseSince: dateOf(data.doseSince) },
  });
}

/** 치료 중단 기록 / 다시 시작 (null) */
export async function saveTreatmentStop(
  db: Db,
  userId: string,
  stop: { date: string; reason: StopReasonCode } | null,
): Promise<void> {
  await db.careEnrollment.update({
    where: { userId },
    data: stop
      ? { stoppedAt: dateOf(stop.date), stopReason: stop.reason }
      : { stoppedAt: null, stopReason: null },
  });
}

/** 케어 기록만 삭제 (건강분석 기록은 남긴다) */
export async function deleteCareData(db: Db, userId: string): Promise<void> {
  const where = { userId };
  await db.careAlert.deleteMany({ where });
  await db.symptomCheckIn.deleteMany({ where });
  await db.mealLog.deleteMany({ where });
  await db.glucoseReading.deleteMany({ where });
  await db.doseLog.deleteMany({ where });
  await db.aiUsage.deleteMany({ where });
  await db.clinicVisit.deleteMany({ where: { patientId: userId } });
  await db.coachMessage.deleteMany({ where: { patientId: userId } });
  await db.careEnrollment.deleteMany({ where });
}

// ─── 투약 ───

export type DoseLogView = DoseRecord & { id: string };

export async function listDoses(
  db: Db,
  userId: string,
  since?: Date,
): Promise<DoseLogView[]> {
  const rows = await db.doseLog.findMany({
    where: { userId, ...(since ? { takenAt: { gte: since } } : {}) },
    orderBy: { takenAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    takenAt: r.takenAt,
    status: r.status,
    doseMg: Number(r.doseMg),
    site: r.site as InjectionSite | null,
  }));
}

export async function saveDose(
  db: Db,
  userId: string,
  data: DoseFormData,
): Promise<void> {
  await db.doseLog.create({
    data: {
      userId,
      takenAt: kstDateTime(data.date, data.time),
      status: data.status,
      doseMg: data.doseMg,
      site: data.site,
    },
  });
}

/** 본인 기록만 지운다. 지운 개수 반환 */
export async function deleteDose(
  db: Db,
  userId: string,
  id: string,
): Promise<number> {
  return (await db.doseLog.deleteMany({ where: { id, userId } })).count;
}

// ─── 혈당 ───

export async function importGlucose(
  db: Db,
  userId: string,
  readings: { measuredAt: Date; mgdl: number }[],
  source: "CSV_UPLOAD" | "CGM_PARTNER" | "SAMPLE",
): Promise<number> {
  let inserted = 0;
  // 한 번에 너무 많은 값을 보내지 않도록 나눠 넣는다
  for (let i = 0; i < readings.length; i += 2000) {
    const chunk = readings.slice(i, i + 2000);
    inserted += (
      await db.glucoseReading.createMany({
        data: chunk.map((r) => ({ userId, ...r, source })),
        skipDuplicates: true,
      })
    ).count;
  }
  return inserted;
}

/** [from, to) 측정값 (시간순) */
export async function loadGlucose(
  db: Db,
  userId: string,
  from: number,
  to: number,
): Promise<GlucosePoint[]> {
  const rows = await db.glucoseReading.findMany({
    where: { userId, measuredAt: { gte: new Date(from), lt: new Date(to) } },
    orderBy: { measuredAt: "asc" },
    select: { measuredAt: true, mgdl: true },
  });
  return rows.map((r) => ({ t: r.measuredAt.getTime(), mgdl: r.mgdl }));
}

export async function latestGlucose(
  db: Db,
  userId: string,
): Promise<GlucosePoint | null> {
  const row = await db.glucoseReading.findFirst({
    where: { userId },
    orderBy: { measuredAt: "desc" },
    select: { measuredAt: true, mgdl: true },
  });
  return row ? { t: row.measuredAt.getTime(), mgdl: row.mgdl } : null;
}

export async function deleteGlucose(db: Db, userId: string): Promise<number> {
  return (await db.glucoseReading.deleteMany({ where: { userId } })).count;
}

// ─── 식사 ───

export type MealView = {
  id: string;
  eatenAt: Date;
  mealType: MealType;
  items: MealItem[];
  kcal: number | null;
  carbsG: number | null;
  proteinG: number | null;
  source: "MANUAL" | "PHOTO_AI";
  /** 혈당 기록으로 계산한 식후 반응 (측정값이 부족하면 null) */
  response: MealResponse | null;
};

export async function saveMeal(
  db: Db,
  userId: string,
  data: MealFormData,
): Promise<void> {
  const items: MealItem[] = data.items;
  await db.mealLog.create({
    data: {
      userId,
      eatenAt: kstDateTime(data.date, data.time),
      mealType: data.mealType,
      items: items as unknown as Prisma.InputJsonValue,
      ...mealTotals(items),
      source: data.source,
    },
  });
}

export async function deleteMeal(
  db: Db,
  userId: string,
  id: string,
): Promise<number> {
  return (await db.mealLog.deleteMany({ where: { id, userId } })).count;
}

/** [from, to) 식사 + 식후 반응 (최신순) */
export async function listMeals(
  db: Db,
  userId: string,
  from: number,
  to: number,
): Promise<MealView[]> {
  const rows = await db.mealLog.findMany({
    where: { userId, eatenAt: { gte: new Date(from), lt: new Date(to) } },
    orderBy: { eatenAt: "desc" },
  });
  const glucose = rows.length
    ? await loadGlucose(db, userId, from - HOUR_MS, to + 3 * HOUR_MS)
    : [];
  return rows.map((r) => ({
    id: r.id,
    eatenAt: r.eatenAt,
    mealType: r.mealType,
    items: parseMealItems(r.items),
    kcal: r.kcal,
    carbsG: r.carbsG,
    proteinG: r.proteinG,
    source: r.source,
    response: mealResponse(glucose, r.eatenAt.getTime()),
  }));
}

// ─── 체크인 ───

export type CheckInView = {
  date: string;
  symptoms: SymptomScores;
  redFlags: RedFlagCode[];
  appetite: number | null;
  weightKg: number | null;
  triage: TriageLevel;
};

export async function saveCheckIn(
  db: Db,
  userId: string,
  data: CheckInFormData,
): Promise<TriageLevel> {
  const { level } = triageCheckIn(data);
  const date = dateOf(data.date);
  const row = {
    symptoms: data.symptoms as unknown as Prisma.InputJsonValue,
    redFlags: data.redFlags as unknown as Prisma.InputJsonValue,
    appetite: data.appetite ?? null,
    weightKg: data.weightKg ?? null,
    triage: level,
  };
  await db.symptomCheckIn.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...row },
    update: row,
  });
  return level;
}

/** 최근 체크인 (오늘 포함 days일, 최신순) */
export async function listCheckIns(
  db: Db,
  userId: string,
  today: string,
  days: number,
): Promise<CheckInView[]> {
  const rows = await db.symptomCheckIn.findMany({
    where: {
      userId,
      date: {
        gte: dateOf(addDaysIso(today, -(days - 1))),
        lte: dateOf(today),
      },
    },
    orderBy: { date: "desc" },
  });
  return rows.map((r) => ({
    date: isoOf(r.date),
    symptoms: parseSymptoms(r.symptoms),
    redFlags: parseRedFlags(r.redFlags),
    appetite: r.appetite,
    weightKg: r.weightKg === null ? null : Number(r.weightKg),
    triage: r.triage,
  }));
}

// ─── 위험 신호 ───

export type ActiveAlert = {
  kind: AlertKind;
  level: TriageLevel;
  detectedAt: Date;
};

/** 화면에 보여줄 기간 */
export const ACTIVE_ALERT_DAYS = 7;

/**
 * 최근 기록으로 위험 신호를 다시 계산해 새 신호만 저장하고, 최근 7일 신호를 돌려준다.
 * 같은 신호는 dedupeKey로 한 번만 저장된다 (의원 화면이 이 기록을 읽는다 — 향후).
 */
export async function refreshAlerts(
  db: Db,
  userId: string,
  today: string,
): Promise<ActiveAlert[]> {
  const enrollment = await getEnrollment(db, userId);
  if (!enrollment) return [];
  const windowStart = kstDayStart(addDaysIso(today, -(MISSED_WINDOW_DAYS + 7)));
  const [checkIns, glucose, doses] = await Promise.all([
    listCheckIns(db, userId, today, 7),
    loadGlucose(
      db,
      userId,
      kstDayStart(addDaysIso(today, -7)),
      kstDayStart(addDaysIso(today, 1)),
    ),
    listDoses(db, userId, new Date(windowStart)),
  ]);
  const { drug, startDate } = enrollment;
  const missed = missedDoseCount(drug, startDate, doses, today);
  const signals = evaluateAlerts({
    today,
    checkIns,
    lowEvents: lowEvents(glucose),
    missed: {
      count: missed,
      // 치료 중단을 기록했으면 투약 누락 알림을 만들지 않는다
      alert: !enrollment.stopped && isMissedAlert(drug, missed),
      key: doseSchedule(drug, startDate, doses, today).nextDue,
    },
  });
  if (signals.length)
    await db.careAlert.createMany({
      data: signals.map((s) => ({ userId, ...s })),
      skipDuplicates: true,
    });
  const rows = await db.careAlert.findMany({
    where: {
      userId,
      detectedAt: { gte: new Date(Date.now() - ACTIVE_ALERT_DAYS * DAY_MS) },
    },
    orderBy: { detectedAt: "desc" },
    select: { kind: true, level: true, detectedAt: true },
  });
  // 같은 종류는 가장 최근 것만
  const seen = new Set<AlertKind>();
  return rows.filter((r) => !seen.has(r.kind) && !!seen.add(r.kind));
}

// ─── AI 사용 횟수 ───

export async function countAiUsageToday(
  db: Db,
  userId: string,
  feature: string,
  today: string,
): Promise<number> {
  return db.aiUsage.count({
    where: {
      userId,
      feature,
      createdAt: { gte: new Date(kstDayStart(today)) },
    },
  });
}

export async function recordAiUsage(
  db: Db,
  userId: string,
  feature: string,
  ok: boolean,
): Promise<void> {
  await db.aiUsage.create({ data: { userId, feature, ok } });
}
