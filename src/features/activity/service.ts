import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  EXERCISE_TYPES,
  INTENSITIES,
  projectBioAgeWithActivity,
  type ActivityProjection,
  type DailyActivity,
  type ExerciseSession,
} from "@/domain/bio-age/activity";
import { RAMP_MAX_WEEKS } from "@/domain/bio-age/rules/activity-effects";
import { loadAnalysisInputs } from "@/features/analysis/run";
import { addDays } from "./date";
import type { ActivityFormData } from "./schemas";

type Db = PrismaClient | Prisma.TransactionClient;

const types = new Set<string>(EXERCISE_TYPES);
const intensities = new Set<string>(INTENSITIES);

/** 저장된 JSON → 운동 목록 (형식이 맞지 않는 항목은 버린다) */
export function parseSessions(raw: unknown): ExerciseSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    if (
      s &&
      typeof s === "object" &&
      types.has((s as ExerciseSession).type) &&
      intensities.has((s as ExerciseSession).intensity) &&
      typeof (s as ExerciseSession).minutes === "number"
    )
      return [s as ExerciseSession];
    return [];
  });
}

/** 하루 기록 저장. 걸음수·운동이 모두 비어 있으면 그날 기록을 지운다 */
export async function saveActivityLog(
  db: Db,
  userId: string,
  data: ActivityFormData,
): Promise<"saved" | "deleted"> {
  const date = new Date(`${data.date}T00:00:00Z`);
  if (data.steps === undefined && data.sessions.length === 0) {
    await db.activityLog.deleteMany({ where: { userId, date } });
    return "deleted";
  }
  const row = {
    steps: data.steps ?? null,
    sessions: data.sessions as unknown as Prisma.InputJsonValue,
  };
  await db.activityLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...row },
    update: row,
  });
  return "saved";
}

/** 최근 기록 (오늘 포함 days일, 최신순) */
export async function listActivityLogs(
  db: Db,
  userId: string,
  today: string,
  days: number,
): Promise<DailyActivity[]> {
  const rows = await db.activityLog.findMany({
    where: {
      userId,
      date: {
        gte: new Date(`${addDays(today, -(days - 1))}T00:00:00Z`),
        lte: new Date(`${today}T00:00:00Z`),
      },
    },
    orderBy: { date: "desc" },
    select: { date: true, steps: true, sessions: true },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    steps: r.steps,
    sessions: parseSessions(r.sessions),
  }));
}

export type ActivityOverview = {
  logs: DailyActivity[];
  /** 분석 결과가 없으면 null */
  age: number | null;
  projection: ActivityProjection | null;
};

/**
 * 최근 기록 + 가장 최근 분석 결과 기준 운동 반영 예상 생체나이.
 * 효과가 쌓이는 최대 기간(12주)까지의 기록만 쓴다.
 */
export async function getActivityOverview(
  db: Db,
  userId: string,
  today: string,
): Promise<ActivityOverview> {
  const logs = await listActivityLogs(db, userId, today, RAMP_MAX_WEEKS * 7);
  const latest = await db.assessment.findFirst({
    where: { userId, status: "ANALYZED", result: { isNot: null } },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });
  if (!latest) return { logs, age: null, projection: null };
  const { snapshot, bioAgeInput } = await loadAnalysisInputs(db, latest.id);
  const exercise = snapshot.survey.exercise;
  return {
    logs,
    age: bioAgeInput.age,
    projection: projectBioAgeWithActivity(bioAgeInput, logs, today, {
      dailySteps: exercise.dailySteps,
      aerobicMinPerWeek: exercise.aerobicMinPerWeek,
      strengthTraining: exercise.strengthTraining,
    }),
  };
}
