import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AlertKind } from "@/domain/glp1/alerts";
import {
  glucoseStats,
  lowEvents,
  type GlucoseStats,
  type LowEvent,
} from "@/domain/glp1/cgm";
import {
  adherence,
  agpProfile,
  patientFlag,
  reportPeriod,
  symptomSummary,
  weightTrend,
  type Adherence,
  type AgpHour,
  type FlagReason,
  type PatientFlag,
  type SymptomSummary,
  type WeightTrend,
} from "@/domain/glp1/clinic";
import { daysOnCurrentDose, type DoseRecord } from "@/domain/glp1/dosing";
import { getDrug, type DrugInfo } from "@/domain/glp1/drugs";
import type { TriageLevel } from "@/domain/glp1/symptoms";
import { addDaysIso, DAY_MS, kstDate, kstDayStart } from "@/domain/glp1/time";
import {
  getEnrollment,
  listCheckIns,
  listDoses,
  listMeals,
  loadGlucose,
  refreshAlerts,
  type DoseLogView,
  type Enrollment,
} from "@/features/care/service";

type Db = PrismaClient | Prisma.TransactionClient;

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

export type StaffContext = {
  userId: string;
  clinicId: string;
  clinicName: string;
  role: "DOCTOR" | "NURSE";
};

export async function getStaff(
  db: Db,
  userId: string,
): Promise<StaffContext | null> {
  const row = await db.clinicStaff.findUnique({
    where: { userId },
    include: { clinic: { select: { name: true } } },
  });
  return row
    ? {
        userId,
        clinicId: row.clinicId,
        clinicName: row.clinic.name,
        role: row.role,
      }
    : null;
}

/** 감사 기록 — 누가 어떤 환자의 무엇을 했는지 (건강정보 값은 남기지 않는다) */
export async function logAccess(
  db: Db,
  staff: StaffContext,
  action: string,
  patientId?: string,
): Promise<void> {
  await db.clinicAccessLog.create({
    data: {
      staffUserId: staff.userId,
      clinicId: staff.clinicId,
      patientId,
      action,
    },
  });
}

/**
 * 접근 확인: 이 의원에 연결되어 있고 "담당 의원 공유"에 동의한 환자만.
 * 동의를 철회하거나 다른 의원으로 옮기면 바로 볼 수 없다.
 */
export async function getSharedPatient(
  db: Db,
  clinicId: string,
  patientId: string,
): Promise<
  | (Enrollment & {
      displayName: string;
      chartNo: string | null;
      nextVisitOn: string | null;
    })
  | null
> {
  const row = await db.careEnrollment.findFirst({
    where: { userId: patientId, clinicId, shareWithClinic: true },
    select: {
      chartNo: true,
      nextVisitOn: true,
      user: { select: { displayName: true, deletedAt: true } },
    },
  });
  if (!row || row.user.deletedAt) return null;
  const enrollment = await getEnrollment(db, patientId);
  if (!enrollment) return null;
  return {
    ...enrollment,
    displayName: row.user.displayName,
    chartNo: row.chartNo,
    nextVisitOn: row.nextVisitOn ? isoOf(row.nextVisitOn) : null,
  };
}

// ─── 환자 목록 ───

export type PatientRow = {
  patientId: string;
  displayName: string;
  chartNo: string | null;
  drug: DrugInfo;
  doseMg: number;
  /** 현재 용량을 쓴 날 수 (시작일 = 0) */
  daysOnDose: number;
  adherence28: number | null;
  lastCheckIn: string | null;
  lastVisit: string | null;
  nextVisitOn: string | null;
  flag: PatientFlag;
  reasons: FlagReason[];
};

/** 확인하지 않은 위험 신호를 보여주는 기간 */
export const OPEN_ALERT_DAYS = 14;

export type OpenAlert = {
  id: string;
  patientId: string;
  displayName: string;
  kind: AlertKind;
  level: TriageLevel;
  detectedAt: Date;
  detail: string | null;
};

/**
 * 공유 동의 환자 목록 (다음 내원일 순, 없으면 맨 뒤) + 확인하지 않은 위험 신호.
 * 환자가 앱을 열지 않아도 투약 누락 등이 반영되도록 목록을 열 때 신호를 다시 계산한다
 * (파일럿 규모 기준 — 환자가 많아지면 예약 작업으로 옮긴다).
 */
export async function listClinicPatients(
  db: Db,
  clinicId: string,
  today: string,
  now: number,
): Promise<{ patients: PatientRow[]; alerts: OpenAlert[] }> {
  const rows = await db.careEnrollment.findMany({
    where: { clinicId, shareWithClinic: true, user: { deletedAt: null } },
    include: { user: { select: { displayName: true } } },
  });
  const ids = rows.map((r) => r.userId);
  if (!ids.length) return { patients: [], alerts: [] };

  for (const id of ids) await refreshAlerts(db, id, today);
  const since28 = addDaysIso(today, -27);
  const [doses, lastCheckIns, visits, alertRows] = await Promise.all([
    db.doseLog.findMany({
      where: {
        userId: { in: ids },
        takenAt: { gte: new Date(kstDayStart(since28) - 7 * DAY_MS) },
      },
    }),
    db.symptomCheckIn.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { date: true },
    }),
    db.clinicVisit.groupBy({
      by: ["patientId"],
      where: { clinicId, patientId: { in: ids } },
      _max: { visitedOn: true },
    }),
    db.careAlert.findMany({
      where: {
        userId: { in: ids },
        acknowledgedAt: null,
        detectedAt: { gte: new Date(now - OPEN_ALERT_DAYS * DAY_MS) },
      },
      orderBy: { detectedAt: "desc" },
    }),
  ]);
  const name = new Map(rows.map((r) => [r.userId, r.user.displayName]));
  const patients = rows.flatMap((r): PatientRow[] => {
    const drug = getDrug(r.drugCode);
    if (!drug) return [];
    const startDate = isoOf(r.startDate);
    const mine: DoseRecord[] = doses
      .filter((d) => d.userId === r.userId)
      .map((d) => ({
        takenAt: d.takenAt,
        status: d.status,
        doseMg: Number(d.doseMg),
        site: d.site,
      }));
    const adh = adherence(drug, startDate, mine, since28, today);
    const lastCheckIn = lastCheckIns.find((c) => c.userId === r.userId)?._max
      .date;
    const lastVisit = visits.find((v) => v.patientId === r.userId)?._max
      .visitedOn;
    const openAlerts = [
      ...new Set(
        alertRows.filter((a) => a.userId === r.userId).map((a) => a.kind),
      ),
    ];
    const { flag, reasons } = patientFlag({
      today,
      openAlerts,
      adherenceRate: adh.rate,
      lastCheckIn: lastCheckIn ? isoOf(lastCheckIn) : null,
      enrolledOn: startDate,
    });
    return [
      {
        patientId: r.userId,
        displayName: r.user.displayName,
        chartNo: r.chartNo,
        drug,
        doseMg: Number(r.currentDoseMg),
        daysOnDose: Math.max(0, daysOnCurrentDose(isoOf(r.doseSince), today)),
        adherence28: adh.rate,
        lastCheckIn: lastCheckIn ? isoOf(lastCheckIn) : null,
        lastVisit: lastVisit ? isoOf(lastVisit) : null,
        nextVisitOn: r.nextVisitOn ? isoOf(r.nextVisitOn) : null,
        flag,
        reasons,
      },
    ];
  });
  patients.sort(
    (a, b) =>
      (a.nextVisitOn ?? "9999").localeCompare(b.nextVisitOn ?? "9999") ||
      a.displayName.localeCompare(b.displayName, "ko"),
  );
  return {
    patients,
    alerts: alertRows.map((a) => ({
      id: a.id,
      patientId: a.userId,
      displayName: name.get(a.userId) ?? "",
      kind: a.kind,
      level: a.level,
      detectedAt: a.detectedAt,
      detail: a.detail,
    })),
  };
}

// ─── 내원 전 1장 리포트 ───

export type PatientReport = {
  patient: NonNullable<Awaited<ReturnType<typeof getSharedPatient>>>;
  period: { from: string; to: string; sinceVisit: string | null };
  daysOnDose: number;
  alerts: {
    id: string;
    kind: AlertKind;
    level: TriageLevel;
    detectedAt: Date;
    acknowledgedAt: Date | null;
    detail: string | null;
  }[];
  weight: WeightTrend | null;
  glucose: {
    period: GlucoseStats | null;
    /** AGP·지표는 최근 14일 기준 (국제 합의 보고 형식) */
    last14: GlucoseStats | null;
    agp: (AgpHour | null)[];
    lows: LowEvent[];
  };
  symptoms: SymptomSummary;
  symptoms14: SymptomSummary;
  adherence: { period: Adherence; last28: Adherence };
  doses: DoseLogView[];
  meals: {
    count: number;
    avgProteinPerDay: number | null;
    avgRise: number | null;
    days: number;
  };
};

export const REPORT_GLUCOSE_DAYS = 14;

export async function getPatientReport(
  db: Db,
  clinicId: string,
  patientId: string,
  today: string,
  now: number,
): Promise<PatientReport | null> {
  const patient = await getSharedPatient(db, clinicId, patientId);
  if (!patient) return null;
  await refreshAlerts(db, patientId, today);
  const visits = await db.clinicVisit.findMany({
    where: { clinicId, patientId },
    select: { visitedOn: true },
  });
  const period = reportPeriod(
    today,
    patient.startDate,
    visits.map((v) => isoOf(v.visitedOn)),
  );
  const from = kstDayStart(period.from);
  const to = Math.min(now, kstDayStart(addDaysIso(today, 1)));
  const g14From = kstDayStart(addDaysIso(today, -(REPORT_GLUCOSE_DAYS - 1)));
  const since28 = addDaysIso(today, -27);
  const earliest = Math.min(from, kstDayStart(since28));
  const [doses, checkIns, glucose, meals, alerts] = await Promise.all([
    listDoses(db, patientId, new Date(earliest - 7 * DAY_MS)),
    listCheckIns(db, patientId, today, Math.max(28, (to - from) / DAY_MS + 1)),
    loadGlucose(db, patientId, Math.min(from, g14From), to),
    listMeals(db, patientId, from, to),
    db.careAlert.findMany({
      where: { userId: patientId, detectedAt: { gte: new Date(from) } },
      orderBy: { detectedAt: "desc" },
    }),
  ]);
  const periodGlucose = glucose.filter((p) => p.t >= from);
  const last14 = glucose.filter((p) => p.t >= g14From);
  const days = Math.round((to - from) / DAY_MS) || 1;
  const rises = meals.flatMap((m) => (m.response ? [m.response.rise] : []));
  const proteinDays = new Set(
    meals.filter((m) => m.proteinG !== null).map((m) => kstDate(m.eatenAt)),
  );
  const protein = meals.reduce((a, m) => a + (m.proteinG ?? 0), 0);
  return {
    patient,
    period,
    daysOnDose: Math.max(0, daysOnCurrentDose(patient.doseSince, today)),
    alerts: alerts.map((a) => ({
      id: a.id,
      kind: a.kind,
      level: a.level,
      detectedAt: a.detectedAt,
      acknowledgedAt: a.acknowledgedAt,
      detail: a.detail,
    })),
    weight: weightTrend(checkIns, period.from, today),
    glucose: {
      period: glucoseStats(periodGlucose, to - from),
      last14: glucoseStats(last14, to - g14From),
      agp: agpProfile(last14),
      lows: lowEvents(periodGlucose),
    },
    symptoms: symptomSummary(checkIns, period.from, today),
    symptoms14: symptomSummary(checkIns, addDaysIso(today, -13), today),
    adherence: {
      period: adherence(
        patient.drug,
        patient.startDate,
        doses,
        period.from,
        today,
      ),
      last28: adherence(patient.drug, patient.startDate, doses, since28, today),
    },
    doses: doses.filter((d) => d.takenAt.getTime() >= from),
    meals: {
      count: meals.length,
      days,
      avgProteinPerDay: proteinDays.size
        ? Math.round(protein / proteinDays.size)
        : null,
      avgRise: rises.length
        ? Math.round(rises.reduce((a, b) => a + b, 0) / rises.length)
        : null,
    },
  };
}

// ─── 의원 쪽 기록 ───

export async function recordVisit(
  db: Db,
  staff: StaffContext,
  patientId: string,
  visitedOn: string,
): Promise<void> {
  await db.clinicVisit.upsert({
    where: {
      clinicId_patientId_visitedOn: {
        clinicId: staff.clinicId,
        patientId,
        visitedOn: dateOf(visitedOn),
      },
    },
    create: {
      clinicId: staff.clinicId,
      patientId,
      visitedOn: dateOf(visitedOn),
      recordedById: staff.userId,
    },
    update: {},
  });
}

export async function updateClinicFields(
  db: Db,
  patientId: string,
  data: { nextVisitOn: string | null; chartNo: string | null },
): Promise<void> {
  await db.careEnrollment.update({
    where: { userId: patientId },
    data: {
      nextVisitOn: data.nextVisitOn ? dateOf(data.nextVisitOn) : null,
      chartNo: data.chartNo,
    },
  });
}

/** 환자의 확인하지 않은 위험 신호를 모두 확인 처리. 처리한 개수 반환 */
export async function acknowledgeAlerts(
  db: Db,
  staff: StaffContext,
  patientId: string,
): Promise<number> {
  return (
    await db.careAlert.updateMany({
      where: { userId: patientId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgedBy: staff.userId },
    })
  ).count;
}
