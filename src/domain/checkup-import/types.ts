import {
  METRIC_CODES,
  type MetricCode,
} from "@/domain/health-snapshot/metrics";

/**
 * 외부에서 가져오는 검진 데이터의 공통 형식.
 * 사진 판독·건강보험공단·검진기관 등 출처가 달라도 이 형식으로 모은 뒤
 * normalizeCheckup()으로 같은 검증(단위·허용 범위)을 거쳐 저장한다.
 */

/** BMI는 키·체중으로 다시 계산하므로 가져오지 않는다 */
export const IMPORTABLE_CODES = METRIC_CODES.filter(
  (c): c is Exclude<MetricCode, "BMI"> => c !== "BMI",
);
export type ImportableCode = (typeof IMPORTABLE_CODES)[number];

/** Prisma DataSource 중 외부 가져오기에 쓰는 값 */
export type ImportSource = "PHOTO_OCR" | "NHIS" | "CHECKUP_CENTER";

/** 출처별 변환기가 만드는 원본 항목 (단위는 출처에 표시된 그대로) */
export type RawCheckupItem = {
  metric: ImportableCode;
  value: number;
  unit?: string | null;
};

export type RawCheckupData = {
  /** YYYY-MM-DD 권장. 형식이 다르면 normalize 단계에서 버린다 */
  checkupDate?: string | null;
  items: RawCheckupItem[];
};

export type ImportWarningKind =
  /** 알 수 없는 단위라 가져오지 않음 */
  | "unknown-unit"
  /** 단위를 앱 기준 단위로 바꿈 (안내용) */
  | "unit-converted"
  /** 허용 범위를 벗어나 가져오지 않음 */
  | "out-of-range"
  /** 같은 항목이 여러 번 나와 첫 값만 사용 */
  | "duplicate"
  /** 수축기 ≤ 이완기라 혈압 두 값 모두 가져오지 않음 */
  | "bp-order"
  /** 검진일 형식이 잘못되었거나 미래 날짜 */
  | "invalid-date";

export type ImportWarning = { kind: ImportWarningKind; metric?: MetricCode };

export type NormalizedCheckup = {
  checkupDate?: string;
  values: Partial<Record<ImportableCode, number>>;
  warnings: ImportWarning[];
};
