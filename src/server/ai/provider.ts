import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeInput } from "@/domain/narrative/input";
import {
  llmNarrativeJsonSchema,
  llmNarrativeSchema,
  type LlmNarrative,
} from "@/domain/narrative/types";
import { getServerEnv } from "@/server/env";
import { REPORT_NARRATIVE_SYSTEM_PROMPT } from "./prompts";

/** LLM 공급자 추상화 — 교체·테스트가 쉽도록 인터페이스로 분리 */
export interface NarrativeProvider {
  readonly model: string;
  generateReportNarrative(input: NarrativeInput): Promise<LlmNarrative>;
}

export class NarrativeProviderError extends Error {
  constructor(
    readonly kind: "refusal" | "truncated" | "invalid-output" | "api",
    message: string,
  ) {
    super(message);
  }
}

type CreateFn = Anthropic["beta"]["messages"]["create"];

export class AnthropicNarrativeProvider implements NarrativeProvider {
  constructor(
    readonly model: string,
    private readonly create: CreateFn,
  ) {}

  async generateReportNarrative(input: NarrativeInput): Promise<LlmNarrative> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.create({
        model: this.model,
        max_tokens: 16000,
        // 정책상 요청이 거절되면 서버가 권장 모델로 자동 재시도
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          {
            type: "text",
            text: REPORT_NARRATIVE_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `다음 분석 결과를 설명해 주세요.\n\n${JSON.stringify(input)}`,
          },
        ],
        output_config: {
          // 짧은 설명문 작성이라 낮은 effort로 충분
          effort: "low",
          format: { type: "json_schema", schema: llmNarrativeJsonSchema },
        },
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new NarrativeProviderError(
          "api",
          `status ${error.status ?? "unknown"}`,
        );
      }
      throw new NarrativeProviderError(
        "api",
        error instanceof Error ? error.name : "unknown",
      );
    }

    if (response.stop_reason === "refusal")
      throw new NarrativeProviderError("refusal", "refused");
    if (response.stop_reason === "max_tokens")
      throw new NarrativeProviderError("truncated", "max_tokens");

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new NarrativeProviderError("invalid-output", "not json");
    }
    const parsed = llmNarrativeSchema.safeParse(json);
    if (!parsed.success)
      throw new NarrativeProviderError("invalid-output", "schema mismatch");
    return parsed.data;
  }
}

/** API Key가 없으면 null → 템플릿 설명 사용 */
export function getNarrativeProvider(): NarrativeProvider | null {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    timeout: 45_000,
    maxRetries: 1,
  });
  return new AnthropicNarrativeProvider(
    env.LLM_MODEL,
    client.beta.messages.create.bind(client.beta.messages),
  );
}
