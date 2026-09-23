import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ageOn } from "@/domain/analysis/snapshot";
import type {
  AnalysisOutput,
  DomainResult,
  PriorityItem,
} from "@/domain/analysis/types";
import { buildNarrativeInput } from "@/domain/narrative/input";
import { mergeNarrative } from "@/domain/narrative/merge";
import { buildTemplateNarrative } from "@/domain/narrative/templates";
import { narrativeSchema, type Narrative } from "@/domain/narrative/types";
import type { NarrativeProvider } from "@/server/ai/provider";
import { logger } from "@/server/logger";

type StoredResult = {
  engineVersion: string;
  domains: Prisma.JsonValue;
  priorities: Prisma.JsonValue;
};

export function toAnalysisOutput(r: StoredResult): AnalysisOutput {
  const domains = r.domains as unknown as DomainResult[];
  return {
    engineVersion: r.engineVersion,
    domains,
    priorities: r.priorities as unknown as PriorityItem[],
    dataGaps: domains
      .filter((d) => d.status === "DATA_INSUFFICIENT")
      .map((d) => d.domain),
  };
}

export function parseStoredNarrative(
  json: Prisma.JsonValue | null | undefined,
): Narrative | null {
  const parsed = narrativeSchema.safeParse(json);
  return parsed.success ? (parsed.data as Narrative) : null;
}

/**
 * 분석 결과의 설명 문구를 만들어 저장한다 (이미 있으면 그대로 사용).
 * 1) 같은 사용자의 같은 입력(inputHash)에 대한 AI 설명이 있으면 재사용 → 결과 일관성
 * 2) LLM 사용 가능 시: 엔진 JSON → LLM → 안전 검사 → 템플릿과 병합
 * 3) 그 외(키 없음·오류·거절): 템플릿 설명
 */
export async function ensureNarrative(
  db: PrismaClient,
  assessmentId: string,
  provider: NarrativeProvider | null,
): Promise<Narrative> {
  const a = await db.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      userId: true,
      checkupDate: true,
      submittedAt: true,
      createdAt: true,
      user: { select: { profile: { select: { sex: true, birthDate: true } } } },
      result: {
        select: {
          engineVersion: true,
          inputHash: true,
          domains: true,
          priorities: true,
          narrative: true,
        },
      },
    },
  });
  if (!a.result || !a.user.profile)
    throw new Error("analysis result not found");
  const existing = parseStoredNarrative(a.result.narrative);
  if (existing) return existing;

  const reused = await db.analysisResult.findFirst({
    where: {
      assessmentId: { not: assessmentId },
      assessment: { userId: a.userId },
      inputHash: a.result.inputHash,
      engineVersion: a.result.engineVersion,
      llmModel: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { narrative: true, llmModel: true },
  });
  const reusedNarrative = parseStoredNarrative(reused?.narrative);
  if (reused && reusedNarrative) {
    await save(db, assessmentId, reusedNarrative, reused.llmModel);
    logger.info("narrative reused", { assessmentId });
    return reusedNarrative;
  }

  const output = toAnalysisOutput(a.result);
  const age = ageOn(
    a.user.profile.birthDate,
    a.checkupDate ?? a.submittedAt ?? a.createdAt,
  );
  const input = buildNarrativeInput(output, { age, sex: a.user.profile.sex });
  const template = buildTemplateNarrative(output, input);

  let narrative = template;
  let llmModel: string | null = null;
  if (provider && output.priorities.length > 0) {
    const started = Date.now();
    try {
      const llm = await provider.generateReportNarrative(input);
      const merged = mergeNarrative(llm, template);
      narrative = merged.narrative;
      llmModel = provider.model;
      logger.info("narrative generated", {
        assessmentId,
        ms: Date.now() - started,
        source: narrative.source,
        replaced: merged.report.replaced,
      });
    } catch (error) {
      logger.warn("narrative llm failed, using template", {
        assessmentId,
        ms: Date.now() - started,
        error,
      });
    }
  }
  await save(db, assessmentId, narrative, llmModel);
  return narrative;
}

async function save(
  db: PrismaClient,
  assessmentId: string,
  narrative: Narrative,
  llmModel: string | null,
) {
  await db.analysisResult.update({
    where: { assessmentId },
    data: {
      narrative: narrative as unknown as Prisma.InputJsonValue,
      llmModel,
    },
  });
}
