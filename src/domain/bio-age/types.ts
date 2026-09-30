/**
 * 생체나이 데이터 모델
 * 생체나이는 "같은 성별·나이 평균과 비교한 건강검진 수치의 위치"를 나이로 바꿔 보여주는 참고 지표다.
 * 진단이나 질병 가능성을 뜻하지 않는다.
 */
import type { MetricCode } from "@/domain/health-snapshot/metrics";
import type { Therapy } from "@/domain/medication/catalog";
import type { IngredientUse } from "./medication";

export const ORGAN_CODES = [
  "LIVER",
  "VASCULAR",
  "BLOOD_PRESSURE",
  "KIDNEY",
  "DIABETES",
  "ANEMIA",
  "METABOLIC",
] as const;
export type OrganCode = (typeof ORGAN_CODES)[number];

export type BioAgeInput = {
  sex: "MALE" | "FEMALE";
  age: number;
  metrics: Partial<Record<MetricCode, number>>;
  medications: {
    drugCode?: string | null;
    dailyTablets?: number | null;
    purpose?: string | null;
  }[];
};

export type MetricAge = {
  metric: MetricCode;
  /** 측정값 */
  value: number;
  /** 약 복용 보정 추정값 (보정 대상이 아니면 없음) */
  adjustedValue?: number;
  /** 같은 성별·나이 평균 (LOG 지표는 중앙값) */
  referenceMean: number;
  /** 측정값 기준 나이 차이(세) */
  gapYears: number;
  /** 보정값 기준 나이 차이(세) */
  adjustedGapYears: number;
  weight: number;
  /** 크레아티닌으로 계산한 eGFR 등 */
  derived?: boolean;
};

export type OrganAge = {
  organ: OrganCode;
  status: "OK" | "DATA_INSUFFICIENT";
  /** 측정값 기준 생체나이 */
  measuredAge: number | null;
  measuredGap: number | null;
  /** 약 복용 보정 생체나이 (보정이 없으면 측정값 기준과 같다) */
  adjustedAge: number | null;
  adjustedGap: number | null;
  /** 이 영역에 해당하는 약을 먹고 있는지 */
  therapy: Therapy | null;
  /**
   * QUANTIFIED: 성분·용량으로 보정함 / UNQUANTIFIED: 복용 중이지만 성분 정보가 없어 보정 못함
   * NONE: 해당 약 없음
   */
  medication: "QUANTIFIED" | "UNQUANTIFIED" | "NONE";
  metrics: MetricAge[];
};

export type MetabolicFactorCode =
  "WAIST" | "BLOOD_PRESSURE" | "GLUCOSE" | "TRIGLYCERIDE" | "HDL";

export type MetabolicFactor = {
  factor: MetabolicFactorCode;
  /** 측정값 (혈압은 수축기) — 없으면 null */
  value: number | null;
  /** 혈압의 이완기 값 */
  value2?: number | null;
  /** 약 보정 추정값 */
  adjustedValue: number | null;
  adjustedValue2?: number | null;
  /** 판정 기준 문구 (예: "≥130/85 mmHg") */
  criterion: string;
  /** 현재 기준에 해당 */
  met: boolean;
  /** 관련 약 복용으로 기준에 포함 */
  metByTherapy: boolean;
  /** 지금 추세로 기준에 닿기까지 남은 햇수 (이미 해당이면 0, 30년 안에 닿지 않으면 null) */
  yearsToMeet: number | null;
};

export type MetabolicProjection =
  | { status: "DATA_INSUFFICIENT" }
  | { status: "ALREADY_MET"; metCount: number }
  | {
      status: "PROJECTED";
      yearsUntil: number;
      atAge: number;
      atMetabolicAge: number;
      /** 그때 기준에 해당할 것으로 보는 요소 */
      factors: MetabolicFactorCode[];
    }
  | { status: "NOT_WITHIN_HORIZON"; horizonYears: number };

export type BioAgeResult = {
  version: string;
  sex: "MALE" | "FEMALE";
  chronologicalAge: number;
  organs: OrganAge[];
  /** 생체나이를 계산한 영역들의 평균 (약 보정 기준) */
  overall: { age: number; gap: number; organCount: number } | null;
  medications: {
    ingredients: IngredientUse[];
    /** 평균적으로 기대되는 수치 변화 */
    effect: {
      sbp: number;
      dbp: number;
      hba1c: number;
      fpg: number;
      ldlPct: number;
      tgPct: number;
      hdlPct: number;
    };
    /** 복용 중인 목적 (성분 확인 여부와 무관) */
    therapies: Therapy[];
    /** 성분·함량을 몰라 보정하지 못한 목적 */
    unquantified: Therapy[];
  };
  metabolic: {
    factors: MetabolicFactor[];
    metCount: number;
    availableCount: number;
    projection: MetabolicProjection;
  };
};
