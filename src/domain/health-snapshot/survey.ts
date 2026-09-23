import { z } from "zod";

/**
 * 건강문진·생활습관 응답 스키마 (SurveyResponse.answers, schemaVersion = "survey-v1")
 * 모든 문항은 선택 응답이다. 응답하지 않은 문항은 분석에서 "데이터 부족"으로 처리된다.
 */
export const SURVEY_SCHEMA_VERSION = "survey-v1";

export const FREQUENCIES = [
  "NEVER",
  "RARELY",
  "WEEKLY_1_2",
  "WEEKLY_3_4",
  "DAILY",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const frequencyLabels: Record<Frequency, string> = {
  NEVER: "안 함",
  RARELY: "가끔 (월 1~3회)",
  WEEKLY_1_2: "주 1~2회",
  WEEKLY_3_4: "주 3~4회",
  DAILY: "거의 매일",
};

export const SMOKING_STATUSES = ["NEVER", "FORMER", "CURRENT"] as const;
export type SmokingStatus = (typeof SMOKING_STATUSES)[number];

export const smokingLabels: Record<SmokingStatus, string> = {
  NEVER: "피운 적 없음",
  FORMER: "과거에 피웠으나 끊음",
  CURRENT: "현재 피움",
};

/** 1~5 척도 */
const scale = z.number().int().min(1).max(5);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식(HH:MM)을 확인해 주세요.");
const freq = z.enum(FREQUENCIES);

export const exerciseSchema = z.object({
  sessionsPerWeek: z.number().int().min(0).max(14).optional(),
  dailySteps: z.number().int().min(0).max(60000).optional(),
  aerobicMinPerWeek: z.number().int().min(0).max(3000).optional(),
  strengthTraining: z.boolean().optional(),
});

export const sleepSchema = z.object({
  avgHours: z.number().min(0).max(16).optional(),
  bedtime: time.optional(),
  wakeTime: time.optional(),
  satisfaction: scale.optional(),
});

export const dietSchema = z.object({
  breakfast: freq.optional(),
  lateNightSnack: freq.optional(),
  eatingOut: freq.optional(),
  vegetables: freq.optional(),
  fruits: freq.optional(),
  sugaryDrinks: freq.optional(),
  processedFood: freq.optional(),
});

export const alcoholSchema = z.object({
  frequency: freq.optional(),
  /** 1회 음주량 (소주잔 기준) */
  drinksPerOccasion: z.number().min(0).max(50).optional(),
});

export const smokingSchema = z.object({
  status: z.enum(SMOKING_STATUSES).optional(),
  cigarettesPerDay: z.number().int().min(0).max(100).optional(),
});

export const stressSchema = z.object({
  level: scale.optional(),
});

export const surveyAnswersSchema = z.object({
  exercise: exerciseSchema.default({}),
  sleep: sleepSchema.default({}),
  diet: dietSchema.default({}),
  alcohol: alcoholSchema.default({}),
  smoking: smokingSchema.default({}),
  stress: stressSchema.default({}),
  /** "복용 중인 약 없음"을 명시적으로 선택했는지 (미응답과 구분) */
  medicationsNone: z.boolean().optional(),
});

export type SurveyAnswers = z.infer<typeof surveyAnswersSchema>;

/** DB JSON → 검증된 응답. 형식이 맞지 않으면 빈 응답으로 취급한다. */
export function parseSurveyAnswers(json: unknown): SurveyAnswers {
  const parsed = surveyAnswersSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : surveyAnswersSchema.parse({});
}
