import { z } from "zod";
import {
  METRIC_CODES,
  METRICS,
  type MetricCode,
} from "@/domain/health-snapshot/metrics";
import { FREQUENCIES, SMOKING_STATUSES } from "@/domain/health-snapshot/survey";
import { yesNo } from "./form-data";

/** 선택 입력 숫자: 비어 있으면 undefined, 범위 밖이면 친절한 오류 */
function num(
  min: number,
  max: number,
  opts: { int?: boolean; unit?: string; required?: string } = {},
) {
  const range = `${min}~${max}${opts.unit ? ` ${opts.unit}` : ""} 사이로 입력해 주세요.`;
  let schema = z
    .number({
      error: (iss) =>
        iss.input === undefined && opts.required
          ? opts.required
          : "숫자로 입력해 주세요.",
    })
    .min(min, range)
    .max(max, range);
  if (opts.int) schema = schema.int("정수로 입력해 주세요.");
  return z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/,/g, "")) : v),
    schema,
  );
}

function metricNum(code: MetricCode, required?: string) {
  const m = METRICS[code];
  return num(m.inputRange.min, m.inputRange.max, { unit: m.unit, required });
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요.");

function ageOn(birth: Date, today: Date): number {
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ─── STEP 1 기본정보 ───
export const profileFormSchema = z.object({
  displayName: z
    .string({ error: "이름(별명)을 입력해 주세요." })
    .trim()
    .min(1, "이름(별명)을 입력해 주세요.")
    .max(20, "20자 이내로 입력해 주세요."),
  sex: z.enum(["MALE", "FEMALE"], { error: "성별을 선택해 주세요." }),
  birthDate: isoDate
    .optional()
    .refine((v) => v !== undefined, "생년월일을 입력해 주세요.")
    .transform((v) => new Date(`${v}T00:00:00Z`))
    .refine((d) => {
      const age = ageOn(d, new Date());
      return age >= 19 && age <= 100;
    }, "만 19세~100세 사이의 생년월일을 입력해 주세요."),
  HEIGHT: metricNum("HEIGHT", "키를 입력해 주세요."),
  WEIGHT: metricNum("WEIGHT", "체중을 입력해 주세요."),
  WAIST: metricNum("WAIST").optional(),
});
export type ProfileFormInput = z.infer<typeof profileFormSchema>;

// ─── STEP 2 건강검진 ───
/** 키·체중은 기본정보 단계에서 입력하고, BMI는 자동 계산하므로 제외한다 */
export const CHECKUP_INPUT_CODES = METRIC_CODES.filter(
  (c): c is Exclude<MetricCode, "HEIGHT" | "WEIGHT" | "BMI"> =>
    c !== "HEIGHT" && c !== "WEIGHT" && c !== "BMI",
);

export const checkupFormSchema = z
  .object({
    checkupDate: isoDate
      .optional()
      .refine(
        (v) => !v || new Date(v) <= new Date(),
        "미래 날짜는 입력할 수 없습니다.",
      ),
    ...(Object.fromEntries(
      CHECKUP_INPUT_CODES.map((c) => [c, metricNum(c).optional()]),
    ) as Record<
      (typeof CHECKUP_INPUT_CODES)[number],
      z.ZodOptional<ReturnType<typeof metricNum>>
    >),
  })
  .refine((d) => d.SBP === undefined || d.DBP === undefined || d.SBP > d.DBP, {
    path: ["DBP"],
    message:
      "이완기 혈압은 수축기 혈압보다 낮아야 합니다. 두 값을 확인해 주세요.",
  });

// ─── STEP 3 운동·수면 ───
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간을 선택해 주세요.");
const scale = z.enum(["1", "2", "3", "4", "5"]).transform(Number);

export const exerciseSleepFormSchema = z.object({
  exercise: z
    .object({
      sessionsPerWeek: num(0, 14, { int: true, unit: "회" }).optional(),
      dailySteps: num(0, 60000, { int: true, unit: "보" }).optional(),
      aerobicMinPerWeek: num(0, 3000, { int: true, unit: "분" }).optional(),
      strengthTraining: yesNo.optional(),
    })
    .default({}),
  sleep: z
    .object({
      avgHours: num(0, 16, { unit: "시간" }).optional(),
      bedtime: time.optional(),
      wakeTime: time.optional(),
      satisfaction: scale.optional(),
    })
    .default({}),
});

// ─── STEP 4 생활습관 ───
const freq = z.enum(FREQUENCIES);

export const lifestyleFormSchema = z
  .object({
    diet: z
      .object({
        breakfast: freq.optional(),
        lateNightSnack: freq.optional(),
        eatingOut: freq.optional(),
        vegetables: freq.optional(),
        fruits: freq.optional(),
        sugaryDrinks: freq.optional(),
        processedFood: freq.optional(),
      })
      .default({}),
    alcohol: z
      .object({
        frequency: freq.optional(),
        drinksPerOccasion: num(0, 50, { unit: "잔" }).optional(),
      })
      .default({}),
    smoking: z
      .object({
        status: z.enum(SMOKING_STATUSES).optional(),
        cigarettesPerDay: num(0, 100, { int: true, unit: "개비" }).optional(),
      })
      .default({}),
    stress: z.object({ level: scale.optional() }).default({}),
  })
  // 흡연하지 않으면 흡연량은 저장하지 않는다 (최소수집)
  .transform((d) =>
    d.smoking.status === "CURRENT"
      ? d
      : { ...d, smoking: { status: d.smoking.status } },
  )
  .transform((d) =>
    d.alcohol.frequency === "NEVER"
      ? { ...d, alcohol: { frequency: "NEVER" as const } }
      : d,
  );

// ─── STEP 5 복용약 ───
const medText = (max: number) =>
  z.string().trim().max(max, `${max}자 이내로 입력해 주세요.`);

export const medicationsFormSchema = z
  .object({
    none: yesNo.optional(),
    meds: z
      .array(
        z.object({
          name: medText(50).optional(),
          purpose: medText(50).optional(),
          frequency: medText(30).optional(),
        }),
      )
      .max(20, "최대 20개까지 입력할 수 있습니다.")
      .default([]),
  })
  .transform((d) => ({
    none: d.none === true,
    // 약 이름이 없는 행은 무시
    meds: d.none ? [] : d.meds.filter((m) => m.name),
  }));
