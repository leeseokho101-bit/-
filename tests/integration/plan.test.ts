import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CoachingInput } from "@/domain/plan/coaching";
import { sampleUsers } from "@/dev/samples";
import { resetSampleUser } from "@/dev/seed-sample";
import { runAnalysis } from "@/features/analysis/run";
import { getPlanView } from "@/features/plan/queries";
import { ensurePlan } from "@/features/plan/service";
import type { NarrativeProvider } from "@/server/ai/provider";

const db = new PrismaClient();
const EMAIL = "plan-test@example.invalid";
const sample = { ...sampleUsers.find((s) => s.id === "D")!, email: EMAIL };

let userId: string;
let assessmentId: string;
beforeEach(async () => {
  userId = await resetSampleUser(db, sample, "scrypt$x$y");
  assessmentId = (await db.assessment.findFirstOrThrow({ where: { userId } }))
    .id;
  await db.assessment.update({
    where: { id: assessmentId },
    data: { submittedAt: new Date() },
  });
  await runAnalysis(db, assessmentId);
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL, isSample: true } });
  await db.$disconnect();
});

describe("12주 계획 (DB)", () => {
  it("12주 계획을 저장하고, 다시 호출해도 하나만 만든다 (동시 호출 포함)", async () => {
    const [a, b] = await Promise.all([
      ensurePlan(db, assessmentId, null),
      ensurePlan(db, assessmentId, null),
    ]);
    expect(a).toBe(b);
    expect(await ensurePlan(db, assessmentId, null)).toBe(a);
    expect(await db.planWeek.count({ where: { planId: a } })).toBe(12);
  });

  it("LLM 코칭은 안전한 주차만 반영한다", async () => {
    let received: CoachingInput | undefined;
    const provider = {
      model: "fake",
      generateReportNarrative: async () => {
        throw new Error("unused");
      },
      generatePlanCoaching: async (input: CoachingInput) => {
        received = input;
        return {
          weeks: [
            { week: 1, message: "AI 코칭 1주차" },
            { week: 2, message: "위험이 50%입니다." },
          ],
        };
      },
    } satisfies NarrativeProvider;
    const planId = await ensurePlan(db, assessmentId, provider);
    const weeks = await db.planWeek.findMany({
      where: { planId },
      orderBy: { weekNumber: "asc" },
    });
    expect(weeks[0].coaching).toBe("AI 코칭 1주차");
    expect(weeks[1].coaching).not.toContain("50%");
    // 코칭 입력에 식별정보 없음
    expect(JSON.stringify(received)).not.toMatch(
      /example\.invalid|가상 D|1982/,
    );
  });

  it("주간 체크 기록으로 실천율과 체중을 계산한다", async () => {
    const planId = await ensurePlan(db, assessmentId, null);
    const week1 = await db.planWeek.findFirstOrThrow({
      where: { planId, weekNumber: 1 },
    });
    const checks = week1.checks as { id: string }[];
    await db.weeklyCheckIn.create({
      data: {
        weekId: week1.id,
        completed: Object.fromEntries(checks.map((c, i) => [c.id, i === 0])),
        weight: 56.5,
      },
    });
    const view = await getPlanView(userId);
    expect(view?.currentWeek).toBe(1);
    expect(view?.weeks[0].rate).toBeCloseTo(1 / checks.length);
    expect(view?.weeks[0].weight).toBe(56.5);
    expect(view?.baselineWeight).toBe(57);
    expect(view?.weeks[1].rate).toBeNull();
  });
});
