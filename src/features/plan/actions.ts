"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  currentWeekOf,
  weeklyFeedback,
  type PlanCheck,
} from "@/domain/plan/builder";
import type { FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

const checkInSchema = z.object({
  weekNumber: z.coerce.number().int().min(1).max(12),
  weight: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(/,/g, "")) : undefined))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v >= 30 && v <= 250),
      {
        message: "체중은 30~250 kg 사이로 입력해 주세요.",
      },
    ),
});

/** 주간 체크 저장 — 본인의 최신 계획, 현재 주차까지만 기록 가능 */
export async function saveCheckIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(routes.reportPlan);
  const parsed = checkInSchema.safeParse({
    weekNumber: formData.get("weekNumber"),
    weight: formData.get("weight") ?? undefined,
  });
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
    };
  }
  const { weekNumber, weight } = parsed.data;

  const plan = await db.carePlan.findFirst({
    where: { assessment: { userId: user.id, status: "ANALYZED" } },
    orderBy: { assessment: { submittedAt: "desc" } },
    select: {
      startDate: true,
      weeks: {
        where: { weekNumber: { in: [weekNumber, weekNumber - 1] } },
        select: {
          id: true,
          weekNumber: true,
          checks: true,
          checkIns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, completed: true },
          },
        },
      },
    },
  });
  if (!plan) return { message: "12주 계획을 찾을 수 없어요." };
  if (weekNumber > currentWeekOf(plan.startDate, new Date())) {
    return { message: "아직 시작하지 않은 주차는 기록할 수 없어요." };
  }
  const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) return { message: "주차 정보를 찾을 수 없어요." };

  // 이 주차에 정의된 체크 항목만 저장
  const checks = week.checks as unknown as PlanCheck[];
  const completed = Object.fromEntries(
    checks.map((c) => [c.id, formData.get(`check.${c.id}`) === "on"]),
  );
  const existing = week.checkIns[0];
  const data = { completed, weight: weight ?? null };
  if (existing)
    await db.weeklyCheckIn.update({ where: { id: existing.id }, data });
  else await db.weeklyCheckIn.create({ data: { weekId: week.id, ...data } });

  const rate = checks.length
    ? Object.values(completed).filter(Boolean).length / checks.length
    : 0;
  const prevWeek = plan.weeks.find((w) => w.weekNumber === weekNumber - 1);
  const prevCompleted = prevWeek?.checkIns[0]?.completed as
    Record<string, boolean> | undefined;
  const prevChecks =
    (prevWeek?.checks as unknown as PlanCheck[] | undefined) ?? [];
  const prevRate =
    prevCompleted && prevChecks.length
      ? prevChecks.filter((c) => prevCompleted[c.id]).length / prevChecks.length
      : null;

  logger.info("check-in saved", { userId: user.id, weekNumber });
  revalidatePath(routes.reportPlan);
  revalidatePath(routes.dashboard);
  return { notice: weeklyFeedback(rate, prevRate) };
}
