/**
 * 검진·계측 지표 카탈로그.
 * - 프레임워크/DB에 의존하지 않는 도메인 정의 (Prisma MetricCode enum과 테스트로 동기화 확인)
 * - inputRange는 "입력 오타 방지용 허용 범위"이며 의학적 판정 기준이 아니다. 판정 기준은 analysis/rules 에 둔다.
 */
export const METRIC_CODES = [
  "HEIGHT",
  "WEIGHT",
  "BMI",
  "WAIST",
  "SBP",
  "DBP",
  "FASTING_GLUCOSE",
  "HBA1C",
  "TOTAL_CHOLESTEROL",
  "LDL",
  "HDL",
  "TRIGLYCERIDE",
  "AST",
  "ALT",
  "GGT",
  "CREATININE",
  "EGFR",
] as const;

export type MetricCode = (typeof METRIC_CODES)[number];

export type MetricGroup =
  "BODY" | "BLOOD_PRESSURE" | "GLUCOSE" | "LIPID" | "LIVER" | "KIDNEY";

export type MetricDefinition = {
  code: MetricCode;
  group: MetricGroup;
  label: string;
  unit: string;
  /** 소수점 자릿수 */
  decimals: number;
  inputRange: { min: number; max: number };
  /** 전문용어 쉬운 설명 */
  help: string;
  /** 다른 값으로 자동 계산되는 지표 */
  derived?: boolean;
};

export const METRIC_GROUPS: { group: MetricGroup; label: string }[] = [
  { group: "BODY", label: "신체" },
  { group: "BLOOD_PRESSURE", label: "혈압" },
  { group: "GLUCOSE", label: "혈당" },
  { group: "LIPID", label: "지질(콜레스테롤)" },
  { group: "LIVER", label: "간" },
  { group: "KIDNEY", label: "신장(콩팥)" },
];

export const METRICS: Record<MetricCode, MetricDefinition> = {
  HEIGHT: {
    code: "HEIGHT",
    group: "BODY",
    label: "키",
    unit: "cm",
    decimals: 1,
    inputRange: { min: 120, max: 220 },
    help: "신장(키)입니다.",
  },
  WEIGHT: {
    code: "WEIGHT",
    group: "BODY",
    label: "체중",
    unit: "kg",
    decimals: 1,
    inputRange: { min: 30, max: 250 },
    help: "몸무게입니다.",
  },
  BMI: {
    code: "BMI",
    group: "BODY",
    label: "체질량지수(BMI)",
    unit: "kg/m²",
    decimals: 1,
    inputRange: { min: 10, max: 70 },
    help: "키와 체중으로 계산한 체격 지수입니다. 키와 체중을 입력하면 자동으로 계산됩니다.",
    derived: true,
  },
  WAIST: {
    code: "WAIST",
    group: "BODY",
    label: "허리둘레",
    unit: "cm",
    decimals: 1,
    inputRange: { min: 40, max: 200 },
    help: "배꼽 높이에서 잰 허리 둘레로, 복부 지방을 가늠하는 데 쓰입니다.",
  },
  SBP: {
    code: "SBP",
    group: "BLOOD_PRESSURE",
    label: "수축기 혈압",
    unit: "mmHg",
    decimals: 0,
    inputRange: { min: 60, max: 260 },
    help: "심장이 수축할 때의 혈압으로, 흔히 '높은 쪽 혈압'이라고 합니다.",
  },
  DBP: {
    code: "DBP",
    group: "BLOOD_PRESSURE",
    label: "이완기 혈압",
    unit: "mmHg",
    decimals: 0,
    inputRange: { min: 30, max: 160 },
    help: "심장이 쉴 때의 혈압으로, 흔히 '낮은 쪽 혈압'이라고 합니다.",
  },
  FASTING_GLUCOSE: {
    code: "FASTING_GLUCOSE",
    group: "GLUCOSE",
    label: "공복혈당",
    unit: "mg/dL",
    decimals: 0,
    inputRange: { min: 40, max: 500 },
    help: "8시간 이상 금식한 뒤 잰 혈액 속 당 수치입니다.",
  },
  HBA1C: {
    code: "HBA1C",
    group: "GLUCOSE",
    label: "당화혈색소(HbA1c)",
    unit: "%",
    decimals: 1,
    inputRange: { min: 3, max: 18 },
    help: "최근 2~3개월 동안의 평균적인 혈당 상태를 보여주는 수치입니다.",
  },
  TOTAL_CHOLESTEROL: {
    code: "TOTAL_CHOLESTEROL",
    group: "LIPID",
    label: "총콜레스테롤",
    unit: "mg/dL",
    decimals: 0,
    inputRange: { min: 50, max: 600 },
    help: "혈액 속 콜레스테롤의 전체 양입니다.",
  },
  LDL: {
    code: "LDL",
    group: "LIPID",
    label: "LDL 콜레스테롤",
    unit: "mg/dL",
    decimals: 0,
    inputRange: { min: 10, max: 400 },
    help: "혈관에 쌓일 수 있어 흔히 '나쁜 콜레스테롤'이라고 부릅니다.",
  },
  HDL: {
    code: "HDL",
    group: "LIPID",
    label: "HDL 콜레스테롤",
    unit: "mg/dL",
    decimals: 0,
    inputRange: { min: 10, max: 150 },
    help: "혈관의 콜레스테롤을 치워주는 역할을 해 흔히 '좋은 콜레스테롤'이라고 부릅니다.",
  },
  TRIGLYCERIDE: {
    code: "TRIGLYCERIDE",
    group: "LIPID",
    label: "중성지방",
    unit: "mg/dL",
    decimals: 0,
    inputRange: { min: 10, max: 3000 },
    help: "혈액 속 지방의 한 종류로, 식습관과 음주의 영향을 많이 받습니다.",
  },
  AST: {
    code: "AST",
    group: "LIVER",
    label: "AST",
    unit: "U/L",
    decimals: 0,
    inputRange: { min: 1, max: 2000 },
    help: "간 등에 있는 효소로, 간 상태를 살펴볼 때 참고하는 수치입니다.",
  },
  ALT: {
    code: "ALT",
    group: "LIVER",
    label: "ALT",
    unit: "U/L",
    decimals: 0,
    inputRange: { min: 1, max: 2000 },
    help: "주로 간에 있는 효소로, 간 상태를 살펴볼 때 참고하는 수치입니다.",
  },
  GGT: {
    code: "GGT",
    group: "LIVER",
    label: "감마지티피(γ-GTP)",
    unit: "U/L",
    decimals: 0,
    inputRange: { min: 1, max: 3000 },
    help: "간·담도와 관련된 효소로, 음주 습관의 영향을 받을 수 있습니다.",
  },
  CREATININE: {
    code: "CREATININE",
    group: "KIDNEY",
    label: "크레아티닌",
    unit: "mg/dL",
    decimals: 2,
    inputRange: { min: 0.1, max: 15 },
    help: "근육에서 나오는 노폐물로, 신장이 잘 걸러내는지 볼 때 참고합니다.",
  },
  EGFR: {
    code: "EGFR",
    group: "KIDNEY",
    label: "사구체여과율(eGFR)",
    unit: "mL/min/1.73m²",
    decimals: 0,
    inputRange: { min: 1, max: 200 },
    help: "신장이 노폐물을 걸러내는 능력을 추정한 수치입니다.",
  },
};

export function metricsByGroup(group: MetricGroup): MetricDefinition[] {
  return METRIC_CODES.map((c) => METRICS[c]).filter((m) => m.group === group);
}

export function isWithinInputRange(code: MetricCode, value: number): boolean {
  const { min, max } = METRICS[code].inputRange;
  return Number.isFinite(value) && value >= min && value <= max;
}

/** BMI = 체중(kg) / 키(m)² — 소수 첫째 자리 반올림 */
export function calculateBmi(
  heightCm: number,
  weightKg: number,
): number | null {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
