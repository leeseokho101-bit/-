/**
 * 걸음수·운동에 따른 평균적인 검진 수치 변화 (생체나이 "운동 반영 예상"용 초안)
 *
 * ⚠️ 무작위배정 임상시험 메타분석의 "평균" 효과이며 개인별 효과는 크게 다르다.
 *    실제 검진 수치를 대신하지 않는다. 다음 건강검진에서 실제 변화를 확인한다.
 *    실제 서비스 전 의료·운동 전문가 검토가 필요하다. (docs/RULES_REFERENCE.md §운동 반영 생체나이)
 *
 * 참고 (수치는 원문 초록·본문 기준으로 확인한 값만 사용)
 *  [CORN]  Cornelissen VA, Smart NA. J Am Heart Assoc 2013;2:e004473 — 93개 RCT, 5,223명.
 *          유산소: 수축기/이완기 −3.5/−2.5 mmHg (고혈압군 −8.3/−5.2, 고혈압 전단계 −2.1/−1.7, 정상 −0.75/−1.1)
 *          동적 근력: −1.8/−3.2 (고혈압 전단계 −4.0/−3.8) · 정적(등척성) 근력: −10.9/−6.2 (연구 수 적음)
 *  [BRAV]  Bravata DM et al. JAMA 2007;298:2296 — 만보계 사용으로 하루 약 2,500보 증가, 수축기 −3.8 mmHg
 *  [UMP]   Umpierre D et al. JAMA 2011;305:1790 — 제2형 당뇨, 구조화 운동 당화혈색소 −0.67%p
 *          (주 150분 이상 −0.89, 미만 −0.36 · 유산소 −0.73, 근력 −0.57)
 *  [ADAG]  Nathan DM et al. Diabetes Care 2008;31:1473 — 당화혈색소 1%p ≈ 평균혈당 28.7 mg/dL
 *  [KOD]   Kodama S et al. Arch Intern Med 2007;167:999 — 유산소 운동 HDL +2.53 mg/dL,
 *          효과가 나타나는 최소량 주 120분(900 kcal)
 *  [KELM]  Kelley GA, Kelley KS. 남성 49개 RCT(2006) — LDL 약 −3%, 중성지방 약 −9%
 *  [KELW]  Kelley GA et al. 여성(2004) — LDL −4.4 mg/dL, 중성지방 −4.2 mg/dL
 *  [JAY]   Jayedi A et al. JAMA Netw Open 2024 — 과체중·비만 성인, 유산소 주 30분당 허리둘레 −0.56 cm (주 300분까지 선형)
 *  [MAFLD] 대사이상 지방간 RCT 메타분석 — 유산소 운동 ALT 약 −2.4 U/L
 *  [TUDOR] Tudor-Locke C et al. Br J Sports Med 2018;52:776 — 분당 100보 ≈ 중강도(3 METs)
 *  [WHO]   WHO 신체활동 지침 2020 — 고강도 1분 = 중강도 2분, 주 150~300분 중강도 권장
 *
 * 추정(가정)으로 둔 값 — 근거 문헌에 직접 수치가 없어 보수적으로 정한 값
 *  - 걸음수 → 중강도 운동 시간 환산 계수 0.75 (모든 걸음이 분당 100보 이상은 아니므로)
 *  - 효과가 쌓이는 속도 (4주 시간상수, 약 12주에 95%)
 *  - 혈당 효과의 기저치별 비율 (당뇨 범위에서 100%, 정상 범위에서 10%)
 *  - 여러 운동의 혈압 효과 결합 (가장 큰 효과 + 나머지의 절반)
 */

/** 유산소 운동 효과 기준량: 주 150분 중강도 [WHO][UMP] */
export const AEROBIC_FULL_DOSE_MIN = 150;
/** 기준량을 넘는 운동은 효과가 덜 늘어난다: 주 300분에서 1.5배로 상한 */
export const AEROBIC_MAX_FACTOR = 1.5;
/** 근력운동 기준량: 주 2회(약 60분) [WHO] */
export const STRENGTH_FULL_DOSE_MIN = 60;
/** 정적 근력운동 기준량: 주 3회 × 약 8분 (연구에 쓰인 일반적인 프로토콜) */
export const ISOMETRIC_FULL_DOSE_MIN = 24;

/** [TUDOR] 분당 100보 = 중강도, 환산 계수 0.75는 가정 */
export const STEPS_PER_MODERATE_MIN = 100;
export const STEPS_CREDIT = 0.75;

/** 평소 걸음수를 모를 때 쓰는 값 ("활동이 적은" 수준으로 흔히 쓰는 하루 5,000보) */
export const DEFAULT_BASELINE_STEPS = 5000;
/** 평소 근력운동을 한다고 답한 경우의 평소량 (주 2회) */
export const BASELINE_STRENGTH_MIN = 60;

/** 효과가 쌓이는 시간상수(주): 1 − e^(−주/4) → 4주 63%, 8주 86%, 12주 95% */
export const RAMP_TAU_WEEKS = 4;
export const RAMP_MAX_WEEKS = 12;
/** 활동 기록을 평균 내는 기간(일) */
export const WINDOW_DAYS = 28;

/** 혈압 분류 (mmHg) — [CORN]의 구분 */
export const BP_CLASS = {
  hypertensive: { sbp: 140, dbp: 90 },
  prehypertensive: { sbp: 120, dbp: 80 },
} as const;

export type BpClass = "HYPERTENSIVE" | "PREHYPERTENSIVE" | "NORMAL";

/** [CORN] 기준량(f=1)에서의 혈압 감소 (mmHg, 양수 = 감소) */
export const bpEffects = {
  AEROBIC: {
    HYPERTENSIVE: { sbp: 8.3, dbp: 5.2 },
    PREHYPERTENSIVE: { sbp: 2.1, dbp: 1.7 },
    NORMAL: { sbp: 0.75, dbp: 1.1 },
  },
  STRENGTH: {
    HYPERTENSIVE: { sbp: 1.8, dbp: 3.2 },
    PREHYPERTENSIVE: { sbp: 4.0, dbp: 3.8 },
    NORMAL: { sbp: 1.8, dbp: 3.2 },
  },
  ISOMETRIC: {
    HYPERTENSIVE: { sbp: 10.9, dbp: 6.2 },
    PREHYPERTENSIVE: { sbp: 10.9, dbp: 6.2 },
    NORMAL: { sbp: 10.9, dbp: 6.2 },
  },
} as const;
/** 운동으로 줄어드는 혈압의 상한 (고혈압군 유산소 효과 수준) */
export const BP_MAX_REDUCTION = { sbp: 10, dbp: 6 } as const;

/** [UMP] 기준량에서의 당화혈색소 감소 (%p) — 당뇨 범위 기준 */
export const HBA1C_EFFECT = { AEROBIC: 0.89, STRENGTH: 0.57 } as const;
/** [ADAG] 당화혈색소 1%p ≈ 28.7 mg/dL */
export const MGDL_PER_HBA1C = 28.7;
/** 혈당 효과 비율: 당화혈색소 5.4% 이하 10% → 7.5% 이상 100% (가정) */
export const GLUCOSE_SCALE = { low: 5.4, high: 7.5, min: 0.1 } as const;

/** [KOD] HDL +2.53 mg/dL, 주 120분 미만이면 효과 없음 */
export const HDL_EFFECT = { mgdl: 2.53, minWeeklyMin: 120 } as const;

/** [KELM][KELW] 기준량에서의 LDL·중성지방 변화 */
export const LIPID_EFFECTS = {
  MALE: { ldlPct: 0.03, tgPct: 0.09 },
  FEMALE: { ldlMgdl: 4.4, tgMgdl: 4.2 },
} as const;

/** [JAY] 유산소 주 30분당 허리둘레 −0.56 cm, 주 300분까지. 과체중 이상(BMI 25 이상 또는 허리둘레 기준 이상)에만 적용 */
export const WAIST_EFFECT = {
  cmPer30Min: 0.56,
  maxWeeklyMin: 300,
  minBmi: 25,
} as const;

/** [MAFLD] 유산소 운동 ALT −2.4 U/L. ALT가 높은 경우(40 U/L 초과)에만 적용 */
export const ALT_EFFECT = { uL: 2.4, minAlt: 40 } as const;
