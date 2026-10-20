/**
 * 식사 기록 — 항목 합계, 사진 추정 결과 형식.
 * 사진 추정(AI)은 음식 이름과 열량·탄수화물·단백질 "추정치"만 돌려준다. 판정·조언은 하지 않는다.
 */
import { z } from "zod";

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type MealItem = {
  name: string;
  kcal?: number;
  carbsG?: number;
  proteinG?: number;
};

export const MAX_MEAL_ITEMS = 8;

export type MealTotals = {
  kcal: number | null;
  carbsG: number | null;
  proteinG: number | null;
};

/** 항목 합계. 한 항목도 값이 없으면 null (0과 구분) */
export function mealTotals(items: MealItem[]): MealTotals {
  const sum = (k: "kcal" | "carbsG" | "proteinG") => {
    const vals = items.map((i) => i[k]).filter((v) => v !== undefined);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0)) : null;
  };
  return {
    kcal: sum("kcal"),
    carbsG: sum("carbsG"),
    proteinG: sum("proteinG"),
  };
}

export function parseMealItems(raw: unknown): MealItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i) => {
    if (!i || typeof i !== "object" || typeof i.name !== "string") return [];
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : undefined;
    return [
      {
        name: i.name,
        kcal: num(i.kcal),
        carbsG: num(i.carbsG),
        proteinG: num(i.proteinG),
      },
    ];
  });
}

// ─── 사진 추정 (LLM 구조화 출력) ───

export const MEAL_PHOTO_VERSION = "meal-photo-v1";

export const mealPhotoSchema = z.object({
  isFood: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string(),
        kcal: z.number(),
        carbsG: z.number(),
        proteinG: z.number(),
      }),
    )
    .max(MAX_MEAL_ITEMS * 2),
});
export type MealPhotoRead = z.infer<typeof mealPhotoSchema>;

export const mealPhotoJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["isFood", "items"],
  properties: {
    isFood: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "kcal", "carbsG", "proteinG"],
        properties: {
          name: { type: "string" },
          kcal: { type: "number" },
          carbsG: { type: "number" },
          proteinG: { type: "number" },
        },
      },
    },
  },
} as const;

/** 추정 결과 정리: 이름 길이·값 범위를 맞추고 최대 항목 수로 자른다 */
export function cleanMealPhotoRead(read: MealPhotoRead): MealItem[] {
  const clamp = (v: number, max: number) =>
    Math.round(Math.min(max, Math.max(0, v)));
  return read.items
    .filter((i) => i.name.trim())
    .slice(0, MAX_MEAL_ITEMS)
    .map((i) => ({
      name: i.name.trim().slice(0, 40),
      kcal: clamp(i.kcal, 3000),
      carbsG: clamp(i.carbsG, 500),
      proteinG: clamp(i.proteinG, 300),
    }));
}
