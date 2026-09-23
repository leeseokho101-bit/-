import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { domainContent, statusContent } from "@/content/domains";
import { ageOn } from "@/domain/analysis/snapshot";
import { ageGroup } from "@/domain/narrative/input";
import { buildCarePlan } from "@/domain/plan/builder";
import { mergeCoaching, type CoachingInput } from "@/domain/plan/coaching";
import { phaseInfo } from "@/domain/plan/library";
import { toAnalysisOutput } from "@/features/analysis/narrative";
import type { NarrativeProvider } from "@/server/ai/provider";
import { logger } from "@/server/logger";

/** 오늘 날짜(UTC 자정) — 계획 시작일 */
function today(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * 분석 결과로 12주 계획을 만들어 저장한다 (이미 있으면 그대로 둔다).
 * 실천 항목은 규칙으로 정해지고, 코칭 메시지만 LLM이 작성할 수 있다.
 */
export async function ensurePlan(
  db: PrismaClient,
  assessmentId: string,
  provider: NarrativeProvider | null,
): Promise<string> {
  const existing = await db.carePlan.findUnique({
    where: { assessmentId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const a = await db.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      checkupDate: true,
      submittedAt: true,
      createdAt: true,
      user: { select: { profile: { select: { sex: true, birthDate: true } } } },
      result: {
        select: { engineVersion: true, domains: true, priorities: true },
      },
    },
  });
  if (!a.result) throw new Error("analysis result not found");
  const output = toAnalysisOutput(a.result);
  const built = buildCarePlan(output);
  const { focus } = built;
  let weeks = built.weeks;

  if (provider && a.user.profile) {
    const started = Date.now();
    const byCode = new Map(output.domains.map((d) => [d.domain, d]));
    const input: CoachingInput = {
      person: {
        ageGroup: ageGroup(
          ageOn(
            a.user.profile.birthDate,
            a.checkupDate ?? a.submittedAt ?? a.createdAt,
          ),
        ),
        sex: a.user.profile.sex === "MALE" ? "남성" : "여성",
      },
      focusAreas: focus.map((d) => ({
        name: domainContent[d].label,
        status:
          statusContent[byCode.get(d)?.status ?? "DATA_INSUFFICIENT"].label,
      })),
      weeks: weeks.map((w) => ({
        week: w.weekNumber,
        phaseTitle: phaseInfo[w.phase].title,
        actions: w.actions.map((x) => x.text),
      })),
    };
    try {
      const merged = mergeCoaching(
        weeks,
        await provider.generatePlanCoaching(input),
      );
      weeks = merged.weeks;
      logger.info("plan coaching generated", {
        assessmentId,
        ms: Date.now() - started,
        replacedWeeks: merged.replaced,
      });
    } catch (error) {
      logger.warn("plan coaching llm failed, using template", {
        assessmentId,
        error,
      });
    }
  }

  try {
    const plan = await db.carePlan.create({
      data: {
        assessmentId,
        startDate: today(),
        weeks: {
          create: weeks.map((w) => ({
            weekNumber: w.weekNumber,
            phase: w.phase,
            goal: w.goal,
            actions: w.actions as unknown as Prisma.InputJsonValue,
            checks: w.checks as unknown as Prisma.InputJsonValue,
            coaching: w.coaching,
          })),
        },
      },
      select: { id: true },
    });
    return plan.id;
  } catch (error) {
    // 동시에 두 번 생성된 경우 (assessmentId unique) → 먼저 만들어진 계획 사용
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const plan = await db.carePlan.findUniqueOrThrow({
        where: { assessmentId },
        select: { id: true },
      });
      return plan.id;
    }
    throw error;
  }
}
