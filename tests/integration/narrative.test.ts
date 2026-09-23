import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NarrativeInput } from "@/domain/narrative/input";
import type { LlmNarrative } from "@/domain/narrative/types";
import { sampleUsers } from "@/dev/samples";
import { resetSampleUser } from "@/dev/seed-sample";
import { ensureNarrative } from "@/features/analysis/narrative";
import { runAnalysis } from "@/features/analysis/run";
import type { NarrativeProvider } from "@/server/ai/provider";

const db = new PrismaClient();
const EMAIL = "narrative-test@example.invalid";
const sample = { ...sampleUsers.find((s) => s.id === "B")!, email: EMAIL };

function fakeProvider(
  impl?: (input: NarrativeInput) => Promise<LlmNarrative>,
): NarrativeProvider & {
  calls: number;
} {
  const p = {
    model: "fake-model",
    calls: 0,
    async generateReportNarrative(
      input: NarrativeInput,
    ): Promise<LlmNarrative> {
      p.calls++;
      if (impl) return impl(input);
      return {
        summary: "AI 요약",
        domains: input.domains.map((d) => ({
          code: d.code,
          explanation: `AI ${d.name}`,
        })),
        priorities: input.priorities.map((x) => ({
          code: x.code,
          why: "AI 이유",
          firstStep: "AI 실천",
        })),
        encouragement: "AI 격려",
      };
    },
    async generatePlanCoaching() {
      return { weeks: [] };
    },
  };
  return p;
}

let assessmentId: string;
beforeEach(async () => {
  const userId = await resetSampleUser(db, sample, "scrypt$x$y");
  assessmentId = (await db.assessment.findFirstOrThrow({ where: { userId } }))
    .id;
  await runAnalysis(db, assessmentId);
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL, isSample: true } });
  await db.$disconnect();
});

describe("ensureNarrative (DB)", () => {
  it("LLM이 없으면 템플릿 설명을 저장한다", async () => {
    const n = await ensureNarrative(db, assessmentId, null);
    expect(n.source).toBe("template");
    const r = await db.analysisResult.findUniqueOrThrow({
      where: { assessmentId },
    });
    expect(r.llmModel).toBeNull();
    expect((r.narrative as { summary: string }).summary).toBe(n.summary);
  });

  it("LLM 설명을 저장하고, 이미 있으면 다시 호출하지 않는다", async () => {
    const provider = fakeProvider();
    const n = await ensureNarrative(db, assessmentId, provider);
    expect(n.source).toBe("llm");
    expect(n.summary).toBe("AI 요약");
    await ensureNarrative(db, assessmentId, provider);
    expect(provider.calls).toBe(1);
    const r = await db.analysisResult.findUniqueOrThrow({
      where: { assessmentId },
    });
    expect(r.llmModel).toBe("fake-model");
  });

  it("LLM 오류 시 템플릿으로 대체한다", async () => {
    const provider = fakeProvider(
      vi.fn().mockRejectedValue(new Error("timeout")),
    );
    const n = await ensureNarrative(db, assessmentId, provider);
    expect(n.source).toBe("template");
  });

  it("같은 사용자의 같은 입력이면 이전 AI 설명을 재사용한다", async () => {
    await ensureNarrative(db, assessmentId, fakeProvider());
    // 같은 입력으로 새 분석 회차 생성
    const userId = (
      await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })
    ).userId;
    const src = await db.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
      include: { measurements: true, survey: true, medications: true },
    });
    const next = await db.assessment.create({
      data: {
        userId,
        checkupDate: src.checkupDate,
        measurements: {
          create: src.measurements.map(({ metric, value, unit, source }) => ({
            metric,
            value,
            unit,
            source,
          })),
        },
        survey: {
          create: {
            schemaVersion: src.survey!.schemaVersion,
            answers: src.survey!.answers!,
          },
        },
      },
    });
    await runAnalysis(db, next.id);
    const second = fakeProvider();
    const n = await ensureNarrative(db, next.id, second);
    expect(second.calls).toBe(0);
    expect(n.summary).toBe("AI 요약");
  });
});
