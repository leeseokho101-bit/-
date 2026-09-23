/**
 * 판정 기준값 (초안)
 *
 * ⚠️ 이 값들은 공개된 국내 기준을 참고해 만든 "건강관리 우선순위용" 초안이며,
 *    실제 서비스 전 의료 전문가 검토가 필요하다. (docs/RULES_REFERENCE.md)
 *    값을 바꾸면 반드시 RULES_VERSION을 올린다 → 저장된 결과와 비교 가능.
 *
 * 참고
 *  [KSSO]  대한비만학회 비만 진료지침 2022 (BMI·허리둘레)
 *  [KSH]   대한고혈압학회 고혈압 진료지침 2022 (혈압 분류)
 *  [KDA]   대한당뇨병학회 당뇨병 진료지침 2023 (공복혈당·당화혈색소 구간)
 *  [KSoLA] 한국지질·동맥경화학회 이상지질혈증 진료지침 2022 (콜레스테롤·중성지방)
 *  [NHIS]  국민건강보험공단 일반건강검진 판정 기준 (간 효소·γ-GTP·크레아티닌·eGFR)
 *  [MetS]  NCEP-ATP III 대사증후군 기준 + 한국인 허리둘레 기준
 *  [WHO]   WHO 신체활동 권고 2020 (주 150분 유산소, 주 2회 근력)
 *  [KDCA]  질병관리청 고위험음주 정의 (남 7잔 / 여 5잔, 주 2회 이상)
 */
export const RULES_VERSION = "rules-2026.09-v1";

/** 구간별 기본 관리 필요 점수 */
export const BAND_POINTS = {
  OPTIMAL: 0,
  NORMAL: 25,
  BORDERLINE: 60,
  ELEVATED: 85,
} as const;

export const thresholds = {
  bmi: { underweight: 18.5, preObese: 23, obese: 25, obeseSevere: 30 }, // [KSSO]
  waist: {
    // [KSSO] 복부비만: 남 ≥90, 여 ≥85. 경계는 기준 -5cm
    MALE: { borderline: 85, elevated: 90 },
    FEMALE: { borderline: 80, elevated: 85 },
  },
  bloodPressure: {
    // [KSH] 정상 <120/<80, 주의 120–129/<80, 고혈압 전단계 130–139/80–89, 고혈압 ≥140/≥90
    optimal: { sbp: 120, dbp: 80 },
    prehypertension: { sbp: 130, dbp: 80 },
    hypertension: { sbp: 140, dbp: 90 },
  },
  fastingGlucose: { borderline: 100, elevated: 126 }, // [KDA]
  hba1c: { borderline: 5.7, elevated: 6.5 }, // [KDA]
  totalCholesterol: { borderline: 200, elevated: 240 }, // [KSoLA]
  ldl: { optimal: 100, borderline: 130, elevated: 160 }, // [KSoLA]
  hdl: { optimal: 60, low: 40 }, // [KSoLA]
  triglyceride: { borderline: 150, elevated: 200 }, // [KSoLA]
  astAlt: { borderline: 41, elevated: 51 }, // [NHIS] ≤40 정상A, 41–50 정상B, ≥51
  ggt: {
    // [NHIS] 남 ≤63 / 64–77 / ≥78, 여 ≤35 / 36–45 / ≥46
    MALE: { borderline: 64, elevated: 78 },
    FEMALE: { borderline: 36, elevated: 46 },
  },
  creatinine: { elevated: 1.5 }, // [NHIS] >1.5 mg/dL
  egfr: { optimal: 90, elevated: 60 }, // [NHIS] <60 관리 필요
  metabolic: {
    // [MetS] 5개 요소
    waist: { MALE: 90, FEMALE: 85 },
    sbp: 130,
    dbp: 85,
    fastingGlucose: 100,
    triglyceride: 150,
    hdl: { MALE: 40, FEMALE: 50 },
  },
  exercise: {
    aerobicMinPerWeek: { optimal: 150, normal: 75 }, // [WHO]
    dailySteps: { optimal: 7500, normal: 5000, borderline: 3000 },
    sessionsPerWeek: { optimal: 3, normal: 1 },
  },
  sleep: {
    hours: {
      optimalMin: 7,
      optimalMax: 8,
      normalMin: 6,
      normalMax: 9,
      lowMin: 5,
    },
    /** 취침 시각(자정 기준 분): 00:00까지 정상, 01:00 이후 늦음 */
    bedtimeLateMin: 60,
    bedtimeNormalMin: 0,
  },
  alcohol: {
    // [KDCA] 고위험음주: 1회 남 7잔 / 여 5잔 이상, 주 2회 이상
    highRiskDrinks: { MALE: 7, FEMALE: 5 },
  },
} as const;
