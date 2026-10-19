import { z } from "zod";
import { EXERCISE_TYPES, INTENSITIES } from "@/domain/bio-age/activity";
import { addDays, EDITABLE_DAYS } from "./date";

export const MAX_SESSIONS = 5;

const intInRange = (min: number, max: number, unit: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/,/g, "")) : v),
    z
      .number({ error: "숫자로 입력해 주세요." })
      .int("정수로 입력해 주세요.")
      .min(min, `${min}~${max.toLocaleString()}${unit} 사이로 입력해 주세요.`)
      .max(max, `${min}~${max.toLocaleString()}${unit} 사이로 입력해 주세요.`),
  );

const sessionSchema = z.object({
  type: z.enum(EXERCISE_TYPES, { error: "운동 종류를 골라 주세요." }),
  intensity: z.enum(INTENSITIES, { error: "강도를 골라 주세요." }),
  minutes: intInRange(1, 600, "분"),
});

/** 활동 기록 폼. today는 한국 날짜 — 오늘부터 지난 7일까지만 기록할 수 있다 */
export function activityFormSchema(today: string) {
  const earliest = addDays(today, -(EDITABLE_DAYS - 1));
  return z.object({
    date: z
      .string({ error: "날짜를 골라 주세요." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라 주세요.")
      .refine(
        (d) => d >= earliest && d <= today,
        `오늘부터 지난 ${EDITABLE_DAYS}일까지만 기록할 수 있어요.`,
      ),
    steps: intInRange(0, 60000, "보").optional(),
    // 비어 있는 줄은 formDataToObject에서 빠진다. 종류·강도·시간 중 일부만 입력하면 오류
    sessions: z.array(sessionSchema).max(MAX_SESSIONS).default([]),
  });
}
export type ActivityFormData = z.output<ReturnType<typeof activityFormSchema>>;
