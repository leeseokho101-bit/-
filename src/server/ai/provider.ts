import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeInput } from "@/domain/narrative/input";
import {
  llmNarrativeJsonSchema,
  llmNarrativeSchema,
  type LlmNarrative,
} from "@/domain/narrative/types";
import { getServerEnv } from "@/server/env";
import {
  llmCoachingJsonSchema,
  llmCoachingSchema,
  type CoachingInput,
  type LlmCoaching,
} from "@/domain/plan/coaching";
import {
  PLAN_COACHING_SYSTEM_PROMPT,
  REPORT_NARRATIVE_SYSTEM_PROMPT,
} from "./prompts";

/** LLM 공급자 추상화 — 교체·테스트가 쉽도록 인터페이스로 분리 */
export interface NarrativeProvider {
  readonly model: string;
  generateReportNarrative(input: NarrativeInput): Promise<LlmNarrative>;
  generatePlanCoaching(input: CoachingInput): Promise<LlmCoaching>;
}

/** LLM 호출 실패 종류 — 호출하는 쪽은 종류와 관계없이 대체 경로(템플릿·직접 입력)로 간다 */
export class LlmProviderError extends Error {
  constructor(
    readonly kind: "refusal" | "truncated" | "invalid-output" | "api",
    message: string,
  ) {
    super(message);
  }
}

export type CreateFn = Anthropic["beta"]["messages"]["create"];

type SafeParser<T> = {
  safeParse(v: unknown): { success: true; data: T } | { success: false };
};

/** 구조화 출력 요청 → JSON 파싱 → zod 검증 (설명 생성·사진 판독 공통) */
export async function requestStructured<T>(
  create: CreateFn,
  model: string,
  req: {
    system: string;
    content: string | Anthropic.Beta.BetaContentBlockParam[];
    jsonSchema: object;
    schema: SafeParser<T>;
    effort: "low" | "medium" | "high";
  },
): Promise<T> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await create({
      model,
      max_tokens: 16000,
      // 정책상 요청이 거절되면 서버가 권장 모델로 자동 재시도
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        {
          type: "text",
          text: req.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: req.content }],
      output_config: {
        effort: req.effort,
        format: {
          type: "json_schema",
          schema: req.jsonSchema as Record<string, unknown>,
        },
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      // 원인 파악용: 상태 코드 + 오류 종류 + API 오류 문구(요청 내용은 담기지 않음)
      const body = error.error as
        { error?: { type?: string; message?: string } } | undefined;
      const detail = [
        `status ${error.status ?? "unknown"}`,
        body?.error?.type ?? error.name,
        body?.error?.message?.slice(0, 200),
      ]
        .filter(Boolean)
        .join(" ");
      throw new LlmProviderError("api", detail);
    }
    throw new LlmProviderError(
      "api",
      error instanceof Error ? error.name : "unknown",
    );
  }

  if (response.stop_reason === "refusal")
    throw new LlmProviderError("refusal", "refused");
  if (response.stop_reason === "max_tokens")
    throw new LlmProviderError("truncated", "max_tokens");

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LlmProviderError("invalid-output", "not json");
  }
  const parsed = req.schema.safeParse(json);
  if (!parsed.success)
    throw new LlmProviderError("invalid-output", "schema mismatch");
  return parsed.data;
}

export class AnthropicNarrativeProvider implements NarrativeProvider {
  constructor(
    readonly model: string,
    private readonly create: CreateFn,
  ) {}

  generateReportNarrative(input: NarrativeInput): Promise<LlmNarrative> {
    return requestStructured(this.create, this.model, {
      system: REPORT_NARRATIVE_SYSTEM_PROMPT,
      content: `다음 분석 결과를 설명해 주세요.\n\n${JSON.stringify(input)}`,
      jsonSchema: llmNarrativeJsonSchema,
      schema: llmNarrativeSchema,
      // 짧은 설명문 작성이라 낮은 effort로 충분
      effort: "low",
    });
  }

  generatePlanCoaching(input: CoachingInput): Promise<LlmCoaching> {
    return requestStructured(this.create, this.model, {
      system: PLAN_COACHING_SYSTEM_PROMPT,
      content: `다음 12주 계획의 주차별 코칭 메시지를 작성해 주세요.\n\n${JSON.stringify(input)}`,
      jsonSchema: llmCoachingJsonSchema,
      schema: llmCoachingSchema,
      effort: "low",
    });
  }
}

/** 서버 전용 Anthropic 클라이언트. API Key가 없으면 null */
export function getAnthropicCreate(timeoutMs: number): CreateFn | null {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    timeout: timeoutMs,
    maxRetries: 1,
  });
  return client.beta.messages.create.bind(client.beta.messages);
}

/** API Key가 없으면 null → 템플릿 설명 사용 */
export function getNarrativeProvider(): NarrativeProvider | null {
  const create = getAnthropicCreate(45_000);
  if (!create) return null;
  return new AnthropicNarrativeProvider(getServerEnv().LLM_MODEL, create);
}
