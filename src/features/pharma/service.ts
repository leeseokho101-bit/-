import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getDrug } from "@/domain/glp1/drugs";
import { parseSymptoms } from "@/domain/glp1/symptoms";
import { kstDate } from "@/domain/glp1/time";
import {
  channelByRegion,
  channelTotals,
  dropoutSummary,
  monthlyEnrollments,
  persistenceCurve,
  toCourse,
  type Course,
  type CourseInput,
} from "@/domain/pharma/stats";

type Db = PrismaClient | Prisma.TransactionClient;
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

export type PharmaContext = {
  userId: string;
  orgId: string;
  orgName: string;
  /** 지속 복용 분석을 볼 수 있는 자사 제품 */
  drugCodes: string[];
};

export async function getPharmaMember(
  db: Db,
  userId: string,
): Promise<PharmaContext | null> {
  const row = await db.pharmaMember.findUnique({
    where: { userId },
    include: { org: true },
  });
  return row
    ? {
        userId,
        orgId: row.orgId,
        orgName: row.org.name,
        drugCodes: row.org.drugCodes,
      }
    : null;
}

export async function logPharmaAccess(
  db: Db,
  m: PharmaContext,
  action: string,
): Promise<void> {
  await db.pharmaAccessLog.create({
    data: { memberUserId: m.userId, orgId: m.orgId, action },
  });
}

/** "제약사 통계 제공"에 동의한 환자만 (탈퇴 요청 계정 제외) */
const consented = {
  allowPharmaStats: true,
  user: { deletedAt: null },
} as const;

/** 채널 현황 (지역 단위 집계) */
export async function loadChannel(db: Db, today: string) {
  const [clinics, enrollments] = await Promise.all([
    db.clinic.findMany({ select: { id: true, region: true, createdAt: true } }),
    db.careEnrollment.findMany({
      where: consented,
      select: {
        userId: true,
        clinicId: true,
        createdAt: true,
        stoppedAt: true,
      },
    }),
  ]);
  const ids = enrollments.map((e) => e.userId);
  const [doses, checkIns, meals] = ids.length
    ? await Promise.all([
        db.doseLog.groupBy({
          by: ["userId"],
          where: { userId: { in: ids } },
          _max: { takenAt: true },
        }),
        db.symptomCheckIn.groupBy({
          by: ["userId"],
          where: { userId: { in: ids } },
          _max: { date: true },
        }),
        db.mealLog.groupBy({
          by: ["userId"],
          where: { userId: { in: ids } },
          _max: { eatenAt: true },
        }),
      ])
    : [[], [], []];
  const last = new Map<string, string>();
  const bump = (id: string, d: string | null) => {
    if (d && (!last.has(id) || last.get(id)! < d)) last.set(id, d);
  };
  for (const r of doses)
    bump(r.userId, r._max.takenAt ? kstDate(r._max.takenAt) : null);
  for (const r of checkIns)
    bump(r.userId, r._max.date ? isoOf(r._max.date) : null);
  for (const r of meals)
    bump(r.userId, r._max.eatenAt ? kstDate(r._max.eatenAt) : null);
  const clinicInputs = clinics.map((c) => ({
    id: c.id,
    region: c.region,
    createdOn: isoOf(c.createdAt),
  }));
  const regionOf = new Map(clinics.map((c) => [c.id, c.region]));
  const patients = enrollments.map((e) => ({
    clinicId: e.clinicId ?? "",
    region: e.clinicId ? (regionOf.get(e.clinicId) ?? null) : null,
    enrolledOn: kstDate(e.createdAt),
    lastActivity: last.get(e.userId) ?? null,
    stopped: !!e.stoppedAt,
  }));
  return {
    totals: channelTotals(clinicInputs, patients, today),
    regions: channelByRegion(
      clinicInputs,
      patients.filter((p) => p.clinicId),
      today,
    ),
    monthly: monthlyEnrollments(patients, today),
  };
}

/** 자사 제품 투약 경과 (동의 환자, 투약 기록이 있는 환자만) */
export async function loadCourses(
  db: Db,
  drugCodes: string[],
  today: string,
): Promise<Course[]> {
  const enrollments = await db.careEnrollment.findMany({
    where: { ...consented, drugCode: { in: drugCodes } },
    select: { userId: true, drugCode: true, stoppedAt: true, stopReason: true },
  });
  const ids = enrollments.map((e) => e.userId);
  if (!ids.length) return [];
  const [doses, checkIns, alerts] = await Promise.all([
    db.doseLog.findMany({
      where: { userId: { in: ids }, status: "TAKEN" },
      select: { userId: true, takenAt: true, doseMg: true },
      orderBy: { takenAt: "asc" },
    }),
    db.symptomCheckIn.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, date: true, symptoms: true },
    }),
    db.careAlert.findMany({
      where: { userId: { in: ids }, kind: { not: "COACH_REFERRAL" } },
      select: { userId: true, detectedAt: true },
    }),
  ]);
  return enrollments.flatMap((e) => {
    const drug = getDrug(e.drugCode);
    if (!drug) return [];
    const input: CourseInput = {
      drugCode: e.drugCode,
      intervalDays: drug.intervalDays,
      doseSteps: drug.doseSteps,
      taken: doses
        .filter((d) => d.userId === e.userId)
        .map((d) => ({ date: kstDate(d.takenAt), doseMg: Number(d.doseMg) })),
      stopped: e.stoppedAt
        ? { date: isoOf(e.stoppedAt), reason: e.stopReason }
        : null,
      giModerateDates: checkIns
        .filter((c) => c.userId === e.userId)
        .filter((c) => {
          const s = parseSymptoms(c.symptoms);
          return (
            s.NAUSEA >= 2 ||
            s.VOMITING >= 2 ||
            s.DIARRHEA >= 2 ||
            s.ABDOMINAL_PAIN >= 2
          );
        })
        .map((c) => isoOf(c.date)),
      alertDates: alerts
        .filter((a) => a.userId === e.userId)
        .map((a) => kstDate(a.detectedAt)),
    };
    const course = toCourse(input, today);
    return course ? [course] : [];
  });
}

export function persistenceView(courses: Course[]) {
  return { curve: persistenceCurve(courses), dropout: dropoutSummary(courses) };
}
