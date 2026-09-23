import { z } from "zod";
import { DOMAIN_CODES, type DomainCode } from "@/domain/analysis/types";

export const NARRATIVE_VERSION = "narrative-v1";

/** 문장 하나의 최대 길이 (넘으면 템플릿 문구로 대체) */
export const MAX_TEXT_LENGTH = 400;

const text = z.string().trim().min(1);

/** LLM이 돌려주는 형식 — 상태·순서는 포함하지 않는다 (엔진 결과가 기준) */
export const llmNarrativeSchema = z.object({
  summary: text,
  domains: z.array(z.object({ code: z.enum(DOMAIN_CODES), explanation: text })),
  priorities: z.array(
    z.object({ code: z.enum(DOMAIN_CODES), why: text, firstStep: text }),
  ),
  encouragement: text,
});
export type LlmNarrative = z.infer<typeof llmNarrativeSchema>;

/** Claude structured outputs용 JSON Schema (llmNarrativeSchema와 같은 구조) */
export const llmNarrativeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "domains", "priorities", "encouragement"],
  properties: {
    summary: { type: "string" },
    domains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "explanation"],
        properties: {
          code: { type: "string", enum: [...DOMAIN_CODES] },
          explanation: { type: "string" },
        },
      },
    },
    priorities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "why", "firstStep"],
        properties: {
          code: { type: "string", enum: [...DOMAIN_CODES] },
          why: { type: "string" },
          firstStep: { type: "string" },
        },
      },
    },
    encouragement: { type: "string" },
  },
} as const;

export type NarrativeSource = "llm" | "template" | "mixed";

/** 저장·화면 표시용 설명 */
export type Narrative = {
  version: typeof NARRATIVE_VERSION;
  source: NarrativeSource;
  summary: string;
  domains: Partial<Record<DomainCode, string>>;
  priorities: { domain: DomainCode; why: string; firstStep: string }[];
  encouragement: string;
};

export const narrativeSchema = z.object({
  version: z.literal(NARRATIVE_VERSION),
  source: z.enum(["llm", "template", "mixed"]),
  summary: z.string(),
  domains: z.partialRecord(z.enum(DOMAIN_CODES), z.string()),
  priorities: z.array(
    z.object({
      domain: z.enum(DOMAIN_CODES),
      why: z.string(),
      firstStep: z.string(),
    }),
  ),
  encouragement: z.string(),
});
