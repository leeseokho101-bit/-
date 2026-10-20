import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  checkCoachMessage,
  isMedicationQuestion,
  MESSAGE_MAX_LENGTH,
  type ScopeResult,
} from "@/domain/coaching/scope";
import type { WeekSummary } from "@/domain/coaching/weekly";
import { glucoseStats } from "@/domain/glp1/cgm";
import { adherence, symptomSummary, weightTrend } from "@/domain/glp1/clinic";
import { addDaysIso, DAY_MS, kstDate, kstDayStart } from "@/domain/glp1/time";
import {
  getEnrollment,
  listCheckIns,
  listDoses,
  listMeals,
  loadGlucose,
  type Enrollment,
} from "@/features/care/service";

type Db = PrismaClient | Prisma.TransactionClient;

export type CoachContext = {
  userId: string;
  displayName: string;
  specialty: "NUTRITION" | "EXERCISE";
};

export async function getCoach(
  db: Db,
  userId: string,
): Promise<CoachContext | null> {
  const row = await db.coach.findUnique({
    where: { userId },
    include: { user: { select: { displayName: true } } },
  });
  return row
    ? { userId, displayName: row.user.displayName, specialty: row.specialty }
    : null;
}

export async function logCoachAccess(
  db: Db,
  coach: CoachContext,
  action: string,
  patientId?: string,
): Promise<void> {
  await db.coachAccessLog.create({
    data: { coachUserId: coach.userId, patientId, action },
  });
}

// ─── 배정 ───

/**
 * 담당 코치가 없으면 담당 환자가 가장 적은 코치로 배정 (같으면 먼저 등록한 코치).
 * 코치가 없으면 미배정으로 두고 코칭 센터의 "미배정 환자"에 보인다.
 */
export async function autoAssignCoach(
  db: Db,
  patientId: string,
): Promise<string | null> {
  const enrollment = await db.careEnrollment.findUnique({
    where: { userId: patientId },
    select: { coachId: true },
  });
  if (!enrollment || enrollment.coachId) return enrollment?.coachId ?? null;
  const coaches = await db.coach.findMany({
    select: {
      userId: true,
      createdAt: true,
      _count: { select: { patients: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!coaches.length) return null;
  const pick = coaches.reduce((a, c) =>
    c._count.patients < a._count.patients ? c : a,
  );
  await db.careEnrollment.update({
    where: { userId: patientId },
    data: { coachId: pick.userId },
  });
  return pick.userId;
}

/** 미배정 환자를 내가 맡기. 이미 누가 맡았으면 false */
export async function claimPatient(
  db: Db,
  coach: CoachContext,
  patientId: string,
): Promise<boolean> {
  const { count } = await db.careEnrollment.updateMany({
    where: { userId: patientId, coachId: null },
    data: { coachId: coach.userId },
  });
  return count === 1;
}

/** 접근 확인: 내가 담당하는 환자만 (탈퇴 요청 계정 제외) */
export async function getAssignedPatient(
  db: Db,
  coach: CoachContext,
  patientId: string,
): Promise<(Enrollment & { displayName: string; patientId: string }) | null> {
  const row = await db.careEnrollment.findFirst({
    where: {
      userId: patientId,
      coachId: coach.userId,
      user: { deletedAt: null },
    },
    select: { user: { select: { displayName: true } } },
  });
  if (!row) return null;
  const e = await getEnrollment(db, patientId);
  return e ? { ...e, displayName: row.user.displayName, patientId } : null;
}

// ─── 대화 ───

export type MessageView = {
  id: string;
  sender: "PATIENT" | "COACH" | "SYSTEM";
  body: string;
  medicationQuestion: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export const THREAD_LIMIT = 100;

/** 최근 대화 (오래된 순) */
export async function listThread(
  db: Db,
  patientId: string,
): Promise<MessageView[]> {
  const rows = await db.coachMessage.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: THREAD_LIMIT,
  });
  return rows.reverse().map((r) => ({
    id: r.id,
    sender: r.sender,
    body: r.body,
    medicationQuestion: r.medicationQuestion,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function sendPatientMessage(
  db: Db,
  patientId: string,
  body: string,
): Promise<void> {
  const text = body.trim().slice(0, MESSAGE_MAX_LENGTH);
  await db.coachMessage.create({
    data: {
      patientId,
      senderId: patientId,
      sender: "PATIENT",
      body: text,
      medicationQuestion: isMedicationQuestion(text),
    },
  });
}

/** 코칭 범위를 벗어난 표현이면 보내지 않는다 */
export async function sendCoachMessage(
  db: Db,
  coach: CoachContext,
  patientId: string,
  body: string,
): Promise<ScopeResult> {
  const check = checkCoachMessage(body);
  if (!check.ok) return check;
  await db.coachMessage.create({
    data: {
      patientId,
      senderId: coach.userId,
      sender: "COACH",
      body: body.trim(),
    },
  });
  return check;
}

/** 읽음 처리: 환자가 보면 코치·안내 메시지, 코치가 보면 환자 메시지 */
export async function markRead(
  db: Db,
  patientId: string,
  reader: "PATIENT" | "COACH",
) {
  await db.coachMessage.updateMany({
    where: {
      patientId,
      readAt: null,
      sender: reader === "PATIENT" ? { in: ["COACH", "SYSTEM"] } : "PATIENT",
    },
    data: { readAt: new Date() },
  });
}

export async function unreadForPatient(
  db: Db,
  patientId: string,
): Promise<number> {
  return db.coachMessage.count({
    where: { patientId, readAt: null, sender: { in: ["COACH", "SYSTEM"] } },
  });
}

// ─── 코칭 센터 받은편지함 ───

/** 이번 주 시작 (한국 시간 월요일) */
export function weekStart(today: string): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDaysIso(today, -((dow + 6) % 7));
}

/** 계획서 기준 주 1~2회 피드백 */
export const WEEKLY_FEEDBACK_TARGET = 1;

export type InboxRow = {
  patientId: string;
  displayName: string;
  unread: number;
  /** 아직 읽지 않은 약·용량 문의가 있는지 */
  medicationQuestion: boolean;
  lastMessage: { sender: MessageView["sender"]; body: string; at: Date } | null;
  /** 이번 주 코치가 보낸 메시지 수 */
  coachMessagesThisWeek: number;
  openAlerts: number;
  lastCheckIn: string | null;
  startDate: string;
};

export async function coachInbox(
  db: Db,
  coach: CoachContext,
  today: string,
  now: number,
): Promise<{
  rows: InboxRow[];
  unassigned: { patientId: string; displayName: string; startDate: string }[];
}> {
  const [mine, unassigned] = await Promise.all([
    db.careEnrollment.findMany({
      where: { coachId: coach.userId, user: { deletedAt: null } },
      include: { user: { select: { displayName: true } } },
    }),
    db.careEnrollment.findMany({
      where: { coachId: null, user: { deletedAt: null } },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);
  const ids = mine.map((m) => m.userId);
  const since = new Date(kstDayStart(weekStart(today)));
  const [unread, medQ, weekly, alerts, lastCheckIns, lastMessages] = ids.length
    ? await Promise.all([
        db.coachMessage.groupBy({
          by: ["patientId"],
          where: { patientId: { in: ids }, sender: "PATIENT", readAt: null },
          _count: true,
        }),
        db.coachMessage.groupBy({
          by: ["patientId"],
          where: {
            patientId: { in: ids },
            sender: "PATIENT",
            readAt: null,
            medicationQuestion: true,
          },
          _count: true,
        }),
        db.coachMessage.groupBy({
          by: ["patientId"],
          where: {
            patientId: { in: ids },
            sender: "COACH",
            createdAt: { gte: since },
          },
          _count: true,
        }),
        db.careAlert.groupBy({
          by: ["userId"],
          where: {
            userId: { in: ids },
            acknowledgedAt: null,
            detectedAt: { gte: new Date(now - 7 * DAY_MS) },
          },
          _count: true,
        }),
        db.symptomCheckIn.groupBy({
          by: ["userId"],
          where: { userId: { in: ids } },
          _max: { date: true },
        }),
        Promise.all(
          ids.map((id) =>
            db.coachMessage.findFirst({
              where: { patientId: id },
              orderBy: { createdAt: "desc" },
            }),
          ),
        ),
      ])
    : [[], [], [], [], [], []];
  const count = (
    list: { patientId?: string; userId?: string; _count: number }[],
    id: string,
  ) => list.find((x) => (x.patientId ?? x.userId) === id)?._count ?? 0;
  const rows: InboxRow[] = mine.map((m, i) => {
    const last = lastMessages[i];
    const lc = lastCheckIns.find((c) => c.userId === m.userId)?._max.date;
    return {
      patientId: m.userId,
      displayName: m.user.displayName,
      unread: count(unread, m.userId),
      medicationQuestion: count(medQ, m.userId) > 0,
      lastMessage: last
        ? { sender: last.sender, body: last.body, at: last.createdAt }
        : null,
      coachMessagesThisWeek: count(weekly, m.userId),
      openAlerts: count(alerts, m.userId),
      lastCheckIn: lc ? lc.toISOString().slice(0, 10) : null,
      startDate: m.startDate.toISOString().slice(0, 10),
    };
  });
  // 읽지 않은 메시지·위험 신호 → 이번 주 피드백 안 한 환자 → 이름
  rows.sort(
    (a, b) =>
      Number(b.unread > 0 || b.openAlerts > 0) -
        Number(a.unread > 0 || a.openAlerts > 0) ||
      Number(a.coachMessagesThisWeek >= WEEKLY_FEEDBACK_TARGET) -
        Number(b.coachMessagesThisWeek >= WEEKLY_FEEDBACK_TARGET) ||
      a.displayName.localeCompare(b.displayName, "ko"),
  );
  return {
    rows,
    unassigned: unassigned.map((u) => ({
      patientId: u.userId,
      displayName: u.user.displayName,
      startDate: u.startDate.toISOString().slice(0, 10),
    })),
  };
}

// ─── 주간 요약 ───

export const SUMMARY_DAYS = 7;

export async function weekSummary(
  db: Db,
  patient: Enrollment & { patientId: string },
  today: string,
  now: number,
): Promise<WeekSummary> {
  const fromDay = addDaysIso(today, -(SUMMARY_DAYS - 1));
  const from = kstDayStart(fromDay);
  const [checkIns, meals, glucose, doses] = await Promise.all([
    listCheckIns(db, patient.patientId, today, 28),
    listMeals(db, patient.patientId, from, now),
    loadGlucose(db, patient.patientId, from, now),
    listDoses(db, patient.patientId, new Date(from - 35 * DAY_MS)),
  ]);
  const sym = symptomSummary(checkIns, fromDay, today);
  const weight = weightTrend(checkIns, fromDay, today);
  const latestWeight =
    checkIns.find((c) => c.weightKg !== null)?.weightKg ?? null;
  const mealDays = new Set(meals.map((m) => kstDate(m.eatenAt)));
  const proteinDays = new Set(
    meals.filter((m) => m.proteinG !== null).map((m) => kstDate(m.eatenAt)),
  );
  const protein = meals.reduce((a, m) => a + (m.proteinG ?? 0), 0);
  const rises = meals.flatMap((m) => (m.response ? [m.response.rise] : []));
  return {
    days: SUMMARY_DAYS,
    checkInDays: sym.checkInDays,
    giModerateDays: sym.giModerateDays,
    constipationDays: sym.bySymptom.CONSTIPATION.days,
    avgAppetite: sym.avgAppetite,
    mealCount: meals.length,
    mealDays: mealDays.size,
    avgProteinPerDay: proteinDays.size
      ? Math.round(protein / proteinDays.size)
      : null,
    latestWeightKg: latestWeight,
    weightChange: weight?.change ?? null,
    tir: glucoseStats(glucose, now - from)?.pct.IN_RANGE ?? null,
    avgMealRise: rises.length
      ? Math.round(rises.reduce((a, b) => a + b, 0) / rises.length)
      : null,
    adherenceRate: adherence(
      patient.drug,
      patient.startDate,
      doses,
      addDaysIso(today, -27),
      today,
    ).rate,
  };
}

// ─── 의원 의뢰 (에스컬레이션) ───

export const REFERRAL_REASONS = [
  "MEDICATION_QUESTION",
  "PERSISTENT_SYMPTOM",
  "LOW_GLUCOSE",
  "OTHER",
] as const;
export type ReferralReason = (typeof REFERRAL_REASONS)[number];

/**
 * 코치가 담당 의원에 확인을 요청한다. 위험 신호(COACH_REFERRAL)로 기록되어
 * 의원 공유 동의가 있으면 의사 대시보드에, 환자 앱에도 안내된다.
 * @returns 의원 화면에 표시되는지
 */
export async function referToClinic(
  db: Db,
  coach: CoachContext,
  patient: Enrollment & { patientId: string },
  detail: string,
): Promise<{ visibleToClinic: boolean }> {
  await db.careAlert.create({
    data: {
      userId: patient.patientId,
      kind: "COACH_REFERRAL",
      level: "CONTACT_CLINIC",
      dedupeKey: `coach-${Date.now()}-${coach.userId}`,
      detail: detail.slice(0, 200),
    },
  });
  await db.coachMessage.create({
    data: {
      patientId: patient.patientId,
      sender: "SYSTEM",
      body: "담당 코치가 의원과 상의해 보시도록 확인을 요청했어요. 담당 의원에 직접 연락해 주셔도 좋아요.",
    },
  });
  return { visibleToClinic: !!patient.clinic && patient.shareWithClinic };
}
