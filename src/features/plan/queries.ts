import "server-only";
import { compareDomains, type DomainChange } from "@/domain/analysis/compare";
import type { DomainResult } from "@/domain/analysis/types";
import {
  currentWeekOf,
  PLAN_WEEKS,
  type PlanAction,
  type PlanCheck,
} from "@/domain/plan/builder";
import type { PlanPhase } from "@/domain/plan/library";
import { db } from "@/server/db";

export type PlanWeekView = {
  weekNumber: number;
  phase: PlanPhase;
  goal: string;
  actions: PlanAction[];
  checks: PlanCheck[];
  coaching: string | null;
  completed: Record<string, boolean> | null;
  weight: number | null;
  /** 체크 항목 달성률 (기록 없으면 null) */
  rate: number | null;
};

export type PlanView = {
  planId: string;
  startDate: Date;
  currentWeek: number;
  finished: boolean;
  weeks: PlanWeekView[];
  baselineWeight: number | null;
};

/** 가장 최근 분석의 12주 계획 + 주차별 최신 체크 기록 */
export async function getPlanView(
  userId: string,
  now = new Date(),
): Promise<PlanView | null> {
  const plan = await db.carePlan.findFirst({
    where: { assessment: { userId, status: "ANALYZED" } },
    orderBy: { assessment: { submittedAt: "desc" } },
    select: {
      id: true,
      startDate: true,
      assessment: {
        select: {
          measurements: {
            where: { metric: "WEIGHT" },
            select: { value: true },
          },
        },
      },
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: {
          weekNumber: true,
          phase: true,
          goal: true,
          actions: true,
          checks: true,
          coaching: true,
          checkIns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { completed: true, weight: true },
          },
        },
      },
    },
  });
  if (!plan) return null;

  const weeks = plan.weeks.map((w) => {
    const checks = w.checks as unknown as PlanCheck[];
    const ci = w.checkIns[0];
    const completed =
      (ci?.completed as Record<string, boolean> | undefined) ?? null;
    const done = completed ? checks.filter((c) => completed[c.id]).length : 0;
    return {
      weekNumber: w.weekNumber,
      phase: w.phase,
      goal: w.goal,
      actions: w.actions as unknown as PlanAction[],
      checks,
      coaching: w.coaching,
      completed,
      weight: ci?.weight ? ci.weight.toNumber() : null,
      rate: completed && checks.length ? done / checks.length : null,
    };
  });
  const days = (now.getTime() - plan.startDate.getTime()) / 86_400_000;
  return {
    planId: plan.id,
    startDate: plan.startDate,
    currentWeek: currentWeekOf(plan.startDate, now),
    finished: days >= PLAN_WEEKS * 7,
    weeks,
    baselineWeight: plan.assessment.measurements[0]?.value.toNumber() ?? null,
  };
}

/** 이전 분석과 비교 (분석이 2번 이상일 때) */
export async function getAnalysisComparison(
  userId: string,
): Promise<{ previousDate: Date; changes: DomainChange[] } | null> {
  const rows = await db.assessment.findMany({
    where: { userId, status: "ANALYZED", result: { isNot: null } },
    orderBy: { submittedAt: "desc" },
    take: 2,
    select: {
      submittedAt: true,
      createdAt: true,
      result: { select: { domains: true } },
    },
  });
  if (rows.length < 2) return null;
  const [current, previous] = rows;
  return {
    previousDate: previous.submittedAt ?? previous.createdAt,
    changes: compareDomains(
      previous.result!.domains as unknown as DomainResult[],
      current.result!.domains as unknown as DomainResult[],
    ),
  };
}
