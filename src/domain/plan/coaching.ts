import { z } from "zod";
import { checkText } from "@/domain/narrative/safety";
import type { PlanWeekDraft } from "./builder";

/** LLM에 보내는 12주 코칭 입력 — 식별정보 없음 */
export type CoachingInput = {
  person: { ageGroup: string; sex: "남성" | "여성" };
  focusAreas: { name: string; status: string }[];
  weeks: { week: number; phaseTitle: string; actions: string[] }[];
};

export const llmCoachingSchema = z.object({
  weeks: z.array(
    z.object({
      week: z.number().int().min(1).max(12),
      message: z.string().trim().min(1),
    }),
  ),
});
export type LlmCoaching = z.infer<typeof llmCoachingSchema>;

export const llmCoachingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["weeks"],
  properties: {
    weeks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["week", "message"],
        properties: { week: { type: "integer" }, message: { type: "string" } },
      },
    },
  },
} as const;

/** 안전 검사를 통과한 주차만 LLM 코칭으로 교체 */
export function mergeCoaching(
  weeks: PlanWeekDraft[],
  llm: LlmCoaching,
): { weeks: PlanWeekDraft[]; replaced: number[] } {
  const byWeek = new Map(llm.weeks.map((w) => [w.week, w.message]));
  const replaced: number[] = [];
  const merged = weeks.map((w) => {
    const msg = byWeek.get(w.weekNumber);
    if (msg && checkText(msg).ok) return { ...w, coaching: msg.trim() };
    replaced.push(w.weekNumber);
    return w;
  });
  return { weeks: merged, replaced };
}
