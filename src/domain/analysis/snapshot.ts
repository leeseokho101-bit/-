import {
  calculateBmi,
  type MetricCode,
} from "@/domain/health-snapshot/metrics";
import type { SurveyAnswers } from "@/domain/health-snapshot/survey";
import type { HealthSnapshot, ManagedCondition } from "./types";

export function ageOn(birthDate: Date, reference: Date): number {
  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = reference.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && reference.getUTCDate() < birthDate.getUTCDate()))
    age--;
  return age;
}

/**
 * 복용 목적 문구에서 "현재 관리 중인 항목"을 추정한다.
 * 약 이름·효능을 판단하지 않고, 사용자가 적은 목적의 키워드만 본다.
 */
const MANAGED_KEYWORDS: [ManagedCondition, RegExp][] = [
  ["BLOOD_PRESSURE", /혈압/],
  ["GLUCOSE", /혈당|당뇨/],
  ["LIPID", /콜레스테롤|고지혈|이상지질|중성지방/],
];

export function inferManagedConditions(
  purposes: (string | null | undefined)[],
): ManagedCondition[] {
  const text = purposes.filter(Boolean).join(" ");
  return MANAGED_KEYWORDS.filter(([, re]) => re.test(text)).map(([c]) => c);
}

/** 저장된 입력 → 분석 엔진 입력. BMI는 키·체중으로 다시 계산해 일관성을 보장한다 */
export function buildHealthSnapshot(input: {
  sex: "MALE" | "FEMALE";
  birthDate: Date;
  /** 나이 계산 기준일 (검진일, 없으면 제출일) */
  referenceDate: Date;
  metrics: Partial<Record<MetricCode, number>>;
  survey: SurveyAnswers;
  medicationPurposes: (string | null | undefined)[];
}): HealthSnapshot {
  const metrics = { ...input.metrics };
  if (metrics.HEIGHT && metrics.WEIGHT) {
    const bmi = calculateBmi(metrics.HEIGHT, metrics.WEIGHT);
    if (bmi !== null) metrics.BMI = bmi;
  }
  return {
    demographics: {
      sex: input.sex,
      age: ageOn(input.birthDate, input.referenceDate),
    },
    metrics,
    survey: input.survey,
    managed: inferManagedConditions(input.medicationPurposes),
  };
}

/** 키 순서를 고정한 JSON — 같은 입력이면 같은 문자열 (inputHash 계산용) */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
