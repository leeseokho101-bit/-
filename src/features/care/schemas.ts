import { z } from "zod";
import { MAX_MEAL_ITEMS, MEAL_TYPES } from "@/domain/glp1/meal";
import { DRUG_CODES, getDrug, isAllowedDose } from "@/domain/glp1/drugs";
import { INJECTION_SITES } from "@/domain/glp1/dosing";
import { RED_FLAGS, SYMPTOMS, type RedFlagCode } from "@/domain/glp1/symptoms";
import { addDaysIso } from "@/domain/glp1/time";
import { numeric } from "@/features/assessment/form-data";

/** 식사 사진 추정 하루 사용 횟수 */
export const MEAL_PHOTO_DAILY_LIMIT = 20;

/** 지난 기록을 고쳐 쓸 수 있는 기간 (오늘 포함) */
export const CARE_EDITABLE_DAYS = 7;

const isoDate = z
  .string({ error: "날짜를 골라 주세요." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라 주세요.");

const recentDate = (today: string) => {
  const earliest = addDaysIso(today, -(CARE_EDITABLE_DAYS - 1));
  return isoDate.refine(
    (d) => d >= earliest && d <= today,
    `오늘부터 지난 ${CARE_EDITABLE_DAYS}일까지만 기록할 수 있어요.`,
  );
};

const time = z
  .string({ error: "시각을 입력해 주세요." })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시각을 입력해 주세요.");

const checked = z.preprocess((v) => v === "on", z.boolean());

const doseMg = numeric(
  z.number({ error: "용량을 골라 주세요." }).positive("용량을 골라 주세요."),
);

const intIn = (min: number, max: number, unit: string) =>
  numeric(
    z
      .number({ error: "숫자로 입력해 주세요." })
      .int("정수로 입력해 주세요.")
      .min(min, `${min}~${max}${unit} 사이로 입력해 주세요.`)
      .max(max, `${min}~${max}${unit} 사이로 입력해 주세요.`),
  );

/** 프로그램 등록·설정. 첫 투약일은 1년 전 ~ 30일 뒤 */
export function enrollFormSchema(today: string) {
  return z
    .object({
      clinicCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{4,20}$/, "카드에 적힌 연결 코드를 확인해 주세요.")
        .optional(),
      drugCode: z.enum(DRUG_CODES, { error: "처방받은 약을 골라 주세요." }),
      doseMg,
      startDate: isoDate.refine(
        (d) => d >= addDaysIso(today, -365) && d <= addDaysIso(today, 30),
        "첫 투약일을 확인해 주세요.",
      ),
      consentService: z.literal("on", {
        error: "서비스 이용 동의(필수)에 체크해 주세요.",
      }),
      shareWithClinic: checked,
      allowResearch: checked,
      allowPharmaStats: checked,
    })
    .superRefine((v, ctx) => {
      if (!isAllowedDose(getDrug(v.drugCode)!, v.doseMg))
        ctx.addIssue({
          code: "custom",
          path: ["doseMg"],
          message: "처방받은 용량을 골라 주세요.",
        });
    });
}
export type EnrollFormData = z.output<ReturnType<typeof enrollFormSchema>>;

/** 담당 의사가 용량을 바꿨을 때 기록 */
export function currentDoseFormSchema(today: string, drugCode: string) {
  const drug = getDrug(drugCode)!;
  return z.object({
    doseMg: doseMg.refine(
      (v) => isAllowedDose(drug, v),
      "처방받은 용량을 골라 주세요.",
    ),
    doseSince: isoDate.refine(
      (d) => d >= addDaysIso(today, -365) && d <= addDaysIso(today, 30),
      "날짜를 확인해 주세요.",
    ),
  });
}

/** 투약 기록. 주사제를 "투약함"으로 기록하면 주사 부위가 필요하다 */
export function doseFormSchema(today: string, drugCode: string) {
  const drug = getDrug(drugCode)!;
  return z
    .object({
      date: recentDate(today),
      time,
      status: z.enum(["TAKEN", "MISSED"], {
        error: "투약 여부를 골라 주세요.",
      }),
      doseMg,
      site: z.enum(INJECTION_SITES).optional(),
    })
    .superRefine((v, ctx) => {
      if (!isAllowedDose(drug, v.doseMg))
        ctx.addIssue({
          code: "custom",
          path: ["doseMg"],
          message: "처방받은 용량을 골라 주세요.",
        });
      if (v.status === "TAKEN" && drug.route === "INJECTION" && !v.site)
        ctx.addIssue({
          code: "custom",
          path: ["site"],
          message: "주사한 부위를 골라 주세요.",
        });
    })
    .transform((v) => ({
      ...v,
      site: v.status === "TAKEN" && drug.route === "INJECTION" ? v.site! : null,
    }));
}
export type DoseFormData = z.output<ReturnType<typeof doseFormSchema>>;

const severity = z.preprocess(
  (v) => (v === undefined ? 0 : Number(v)),
  z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)], {
    error: "정도를 골라 주세요.",
  }),
);

/** 하루 체크인. redFlag.<코드>=on 체크박스 → 코드 목록 */
export function checkInFormSchema(today: string) {
  return z
    .object({
      date: recentDate(today),
      symptoms: z
        .object(
          Object.fromEntries(SYMPTOMS.map((c) => [c, severity])) as Record<
            (typeof SYMPTOMS)[number],
            typeof severity
          >,
        )
        .default(
          Object.fromEntries(SYMPTOMS.map((c) => [c, 0])) as Record<
            (typeof SYMPTOMS)[number],
            0
          >,
        ),
      redFlag: z.record(z.string(), z.string()).optional(),
      appetite: intIn(0, 10, "점").optional(),
      weightKg: numeric(
        z
          .number({ error: "숫자로 입력해 주세요." })
          .min(30, "30~300kg 사이로 입력해 주세요.")
          .max(300, "30~300kg 사이로 입력해 주세요."),
      )
        .transform((v) => Math.round(v * 10) / 10)
        .optional(),
    })
    .transform(({ redFlag, ...rest }) => ({
      ...rest,
      redFlags: RED_FLAGS.filter(
        (c): c is RedFlagCode => redFlag?.[c] === "on",
      ),
    }));
}
export type CheckInFormData = z.output<ReturnType<typeof checkInFormSchema>>;

const itemSchema = z.object({
  name: z
    .string({ error: "음식 이름을 적어 주세요." })
    .trim()
    .min(1, "음식 이름을 적어 주세요.")
    .max(40, "40자 이내로 적어 주세요."),
  kcal: intIn(0, 3000, "kcal").optional(),
  carbsG: intIn(0, 500, "g").optional(),
  proteinG: intIn(0, 300, "g").optional(),
});

/** 식사 기록. 비어 있는 줄은 formDataToObject에서 빠진다 */
export function mealFormSchema(today: string) {
  return z.object({
    date: recentDate(today),
    time,
    mealType: z.enum(MEAL_TYPES, { error: "식사 종류를 골라 주세요." }),
    items: z
      .array(itemSchema, { error: "먹은 음식을 하나 이상 적어 주세요." })
      .min(1, "먹은 음식을 하나 이상 적어 주세요.")
      .max(MAX_MEAL_ITEMS),
    source: z.enum(["MANUAL", "PHOTO_AI"]).default("MANUAL"),
  });
}
export type MealFormData = z.output<ReturnType<typeof mealFormSchema>>;

/** 치료 중단 기록 (담당 의사와 상의 후). 날짜는 1년 전 ~ 오늘 */
export function treatmentStopSchema(
  today: string,
  reasons: readonly [string, ...string[]],
) {
  return z.object({
    date: isoDate.refine(
      (d) => d >= addDaysIso(today, -365) && d <= today,
      "날짜를 확인해 주세요.",
    ),
    reason: z.enum(reasons, { error: "이유를 골라 주세요." }),
  });
}
