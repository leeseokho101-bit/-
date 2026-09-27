/**
 * 생체나이 기준표 (초안) — 성별·연령대별 건강검진 지표 평균과 퍼짐 정도
 *
 * ⚠️ 국민건강영양조사(KNHANES)·국민건강보험공단 건강검진 통계연보의 공개 요약값을 참고해
 *    10세 간격 대표값으로 단순화한 초안이다. 실제 서비스 전 최신 공단 통계로 교체하고
 *    의료 전문가 검토를 받아야 한다. 값을 바꾸면 BIO_AGE_VERSION을 올린다.
 *
 * 환산 방식
 *  - z = (내 값 − 같은 성별·나이 평균) / 표준편차   (한쪽으로 치우친 지표는 로그 척도)
 *  - 지표 나이 차이(세) = z × yearsPerSd  (나쁜 방향이면 +, 좋은 방향이면 −)
 *  - 좋은 방향은 favorableCapYears, 나쁜 방향은 UNFAVORABLE_CAP_YEARS 까지만 반영
 */
import type { MetricCode } from "@/domain/health-snapshot/metrics";

export const BIO_AGE_VERSION = "bioage-2026.09-v1";

/** 평균 기준 나이 (이 사이는 선형 보간, 바깥은 끝값 유지) */
export const REFERENCE_AGES = [20, 30, 40, 50, 60, 70, 80] as const;

export type Direction = "HIGHER_WORSE" | "LOWER_WORSE";

export type MetricReference = {
  direction: Direction;
  /** NORMAL: 산술 평균·표준편차 / LOG: 중앙값·기하표준편차(배수) */
  scale: "NORMAL" | "LOG";
  /** REFERENCE_AGES 순서의 평균(LOG는 중앙값) */
  mean: { MALE: readonly number[]; FEMALE: readonly number[] };
  /** NORMAL: 표준편차, LOG: 기하표준편차(>1) */
  spread: { MALE: number; FEMALE: number };
  /** 표준편차 1만큼 벗어날 때 몇 세로 볼지 */
  yearsPerSd: number;
  /** 좋은 방향으로 벗어날 때 최대 몇 세까지 젊게 볼지 */
  favorableCapYears: number;
};

/** 나쁜 방향으로 벗어날 때 지표 하나당 최대 반영 나이 */
export const UNFAVORABLE_CAP_YEARS = 15;
/** 영역 나이 차이의 최종 범위 */
export const ORGAN_GAP_RANGE = { min: -10, max: 20 } as const;

export type ReferenceMetric = Extract<
  MetricCode,
  | "SBP"
  | "DBP"
  | "FASTING_GLUCOSE"
  | "HBA1C"
  | "TOTAL_CHOLESTEROL"
  | "LDL"
  | "HDL"
  | "TRIGLYCERIDE"
  | "AST"
  | "ALT"
  | "GGT"
  | "EGFR"
  | "HEMOGLOBIN"
  | "WAIST"
>;

export const references: Record<ReferenceMetric, MetricReference> = {
  SBP: {
    direction: "HIGHER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [118, 119, 121, 124, 127, 130, 132],
      FEMALE: [106, 108, 113, 119, 125, 130, 133],
    },
    spread: { MALE: 13, FEMALE: 14 },
    yearsPerSd: 5,
    favorableCapYears: 6,
  },
  DBP: {
    direction: "HIGHER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [74, 78, 81, 80, 77, 74, 72],
      FEMALE: [69, 71, 74, 75, 75, 73, 71],
    },
    spread: { MALE: 10, FEMALE: 9 },
    yearsPerSd: 5,
    favorableCapYears: 6,
  },
  FASTING_GLUCOSE: {
    direction: "HIGHER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [92, 96, 101, 104, 106, 106, 105],
      FEMALE: [88, 91, 94, 98, 101, 103, 103],
    },
    spread: { MALE: 14, FEMALE: 13 },
    yearsPerSd: 5,
    favorableCapYears: 5,
  },
  HBA1C: {
    direction: "HIGHER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [5.3, 5.5, 5.7, 5.9, 6.0, 6.1, 6.1],
      FEMALE: [5.2, 5.3, 5.5, 5.8, 5.9, 6.0, 6.1],
    },
    spread: { MALE: 0.5, FEMALE: 0.45 },
    yearsPerSd: 5,
    favorableCapYears: 5,
  },
  TOTAL_CHOLESTEROL: {
    direction: "HIGHER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [180, 195, 198, 195, 190, 185, 180],
      FEMALE: [180, 182, 190, 205, 205, 200, 195],
    },
    spread: { MALE: 35, FEMALE: 35 },
    yearsPerSd: 4,
    favorableCapYears: 4,
  },
  LDL: {
    direction: "HIGHER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [108, 120, 123, 120, 117, 113, 110],
      FEMALE: [102, 105, 112, 125, 125, 120, 117],
    },
    spread: { MALE: 32, FEMALE: 32 },
    yearsPerSd: 5,
    favorableCapYears: 5,
  },
  HDL: {
    direction: "LOWER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [50, 48, 47, 47, 47, 46, 46],
      FEMALE: [62, 60, 58, 56, 53, 51, 50],
    },
    spread: { MALE: 11, FEMALE: 13 },
    yearsPerSd: 5,
    favorableCapYears: 5,
  },
  TRIGLYCERIDE: {
    direction: "HIGHER_WORSE",
    scale: "LOG",
    mean: {
      MALE: [105, 140, 150, 145, 135, 125, 120],
      FEMALE: [72, 78, 88, 105, 115, 118, 118],
    },
    spread: { MALE: 1.7, FEMALE: 1.6 },
    yearsPerSd: 4,
    favorableCapYears: 4,
  },
  AST: {
    direction: "HIGHER_WORSE",
    scale: "LOG",
    mean: {
      MALE: [23, 24, 25, 25, 25, 25, 25],
      FEMALE: [18, 18, 19, 22, 23, 23, 23],
    },
    spread: { MALE: 1.35, FEMALE: 1.3 },
    yearsPerSd: 4,
    favorableCapYears: 3,
  },
  ALT: {
    direction: "HIGHER_WORSE",
    scale: "LOG",
    mean: {
      MALE: [25, 28, 27, 24, 21, 19, 17],
      FEMALE: [13, 14, 15, 18, 18, 17, 15],
    },
    spread: { MALE: 1.6, FEMALE: 1.5 },
    yearsPerSd: 5,
    favorableCapYears: 3,
  },
  GGT: {
    direction: "HIGHER_WORSE",
    scale: "LOG",
    mean: {
      MALE: [26, 35, 40, 40, 35, 31, 28],
      FEMALE: [14, 15, 17, 20, 21, 21, 20],
    },
    spread: { MALE: 1.85, FEMALE: 1.6 },
    yearsPerSd: 5,
    favorableCapYears: 3,
  },
  EGFR: {
    direction: "LOWER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [115, 105, 98, 91, 84, 74, 63],
      FEMALE: [120, 110, 102, 94, 86, 76, 64],
    },
    spread: { MALE: 14, FEMALE: 14 },
    yearsPerSd: 7,
    favorableCapYears: 6,
  },
  HEMOGLOBIN: {
    direction: "LOWER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [15.5, 15.4, 15.2, 15.0, 14.6, 14.0, 13.4],
      FEMALE: [13.1, 13.2, 13.1, 13.4, 13.3, 13.0, 12.5],
    },
    spread: { MALE: 1.1, FEMALE: 1.0 },
    yearsPerSd: 5,
    favorableCapYears: 2,
  },
  WAIST: {
    direction: "HIGHER_WORSE",
    scale: "NORMAL",
    mean: {
      MALE: [82, 86, 87, 87, 87, 88, 87],
      FEMALE: [72, 74, 77, 80, 83, 86, 87],
    },
    spread: { MALE: 9, FEMALE: 9 },
    yearsPerSd: 5,
    favorableCapYears: 5,
  },
};

/** 성별·나이의 평균(LOG는 중앙값) — 10세 간격 사이는 선형 보간 */
export function referenceMean(
  metric: ReferenceMetric,
  sex: "MALE" | "FEMALE",
  age: number,
): number {
  const values = references[metric].mean[sex];
  const first = REFERENCE_AGES[0];
  const last = REFERENCE_AGES[REFERENCE_AGES.length - 1];
  if (age <= first) return values[0];
  if (age >= last) return values[values.length - 1];
  const i = Math.floor((age - first) / 10);
  const t = (age - REFERENCE_AGES[i]) / 10;
  return values[i] + (values[i + 1] - values[i]) * t;
}

/** 대사증후군 판정 기준 5개 요소 (NCEP-ATP III + 대한비만학회 한국인 허리둘레) */
export const METABOLIC_CRITERIA = {
  waist: { MALE: 90, FEMALE: 85 },
  sbp: 130,
  dbp: 85,
  fastingGlucose: 100,
  triglyceride: 150,
  hdl: { MALE: 40, FEMALE: 50 },
  /** 기준 5개 중 이 개수 이상 */
  minFactors: 3,
} as const;

/** 대사증후군 나이 계산에 쓰는 지표 가중치 (5개 요소를 같은 비중으로) */
export const METABOLIC_WEIGHTS: Partial<Record<ReferenceMetric, number>> = {
  WAIST: 0.2,
  SBP: 0.12,
  DBP: 0.08,
  FASTING_GLUCOSE: 0.2,
  TRIGLYCERIDE: 0.2,
  HDL: 0.2,
};

/**
 * 기준 도달 시점 추정 (초안)
 *
 * - 해마다 각 요소가 "대사증후군 나이" 위치의 성별 평균 곡선 기울기만큼 나빠진다고 본다.
 *   단면 평균 곡선은 고령에서 약 복용자 때문에 평평해지므로, 코호트 연구에서 관찰되는
 *   성인의 평균적인 연간 변화(minAnnualDrift)보다 느리게 보지는 않는다.
 * - 대사증후군 나이가 실제 나이보다 많으면 대사 노화 속도가 빠르다고 보고
 *   pace = 1 + (대사증후군 나이 − 실제 나이) / paceDivisor 배로 진행한다 (paceRange 범위).
 * - 생활습관이 지금과 같다고 가정한 추정이며, 생활습관 개선으로 달라질 수 있다.
 */
export const PROJECTION = {
  /** 최대 몇 년 뒤까지 추정할지 */
  horizonYears: 30,
  /** 이 나이를 넘어서는 추정하지 않는다 */
  maxAge: 90,
  paceDivisor: 20,
  paceRange: { min: 0.5, max: 2 },
  /** 나빠지는 방향의 최소 연간 변화 (LOG 지표는 비율) */
  minAnnualDrift: {
    WAIST: 0.3,
    SBP: 0.5,
    DBP: 0.2,
    FASTING_GLUCOSE: 0.6,
    TRIGLYCERIDE: 0.005,
    HDL: 0.1,
  },
} as const;
