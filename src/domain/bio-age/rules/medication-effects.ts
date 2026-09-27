/**
 * 약 복용에 따른 평균적인 수치 변화 (생체나이 보정용 초안)
 *
 * ⚠️ 무작위배정 임상시험·메타분석의 "평균" 효과이며 개인별 효과는 크게 다르다.
 *    실제 서비스 전 의료·약학 전문가 검토가 필요하다. (docs/RULES_REFERENCE.md §생체나이)
 *    약을 평가하거나 복용 변경을 권하기 위한 값이 아니다.
 *
 * 참고
 *  [LAW]   Law MR et al. BMJ 2003;326:1427 / BMJ 2009;338:b1665 — 혈압약 5계열 표준용량 효과,
 *          절반 용량은 약 20% 작은 효과, 서로 다른 계열 병용은 대체로 더해짐
 *  [SHER]  Sherifali D et al. Diabetes Care 2010;33:1859 — 경구 혈당강하제 당화혈색소 감소
 *  [HIR]   Hirst JA et al. Diabetes Care 2012;35:446 — 메트포르민 용량별 효과
 *  [ADAG]  Nathan DM et al. Diabetes Care 2008;31:1473 — HbA1c 1% ≈ 평균혈당 28.7 mg/dL
 *  [CTT]   Law MR, Wald NJ, Rudnicka AR. BMJ 2003;326:1423 / ACC/AHA 2018 스타틴 강도표
 *  [EZE]   Ezetimibe 병용 시 LDL 추가 약 20–25% 감소 (IMPROVE-IT, 메타분석)
 *  [FIB]   피브레이트 중성지방 30–50% 감소, HDL 10–20% 증가
 *  [OM3]   처방용 오메가-3 4g/일 중성지방 약 25–30% 감소
 */
import type { DrugClass } from "@/domain/medication/catalog";

/**
 * 용량-반응: 표준 용량 대비 용량이 2배가 될 때마다 효과가 (1 + k)배.
 * 효과 계수 = 1 + k × log2(용량/표준용량), [MIN, 1 + 2k] 범위로 제한.
 * [LAW] 절반 용량 효과 ≈ 표준의 78~80% → 혈압약 k ≈ 0.22
 */
export const DOSE_FACTOR_MIN = 0.4;

export const bpEffects: Partial<
  Record<DrugClass, { sbp: number; dbp: number; k: number }>
> = {
  // [LAW] 2009 표준용량 수축기/이완기 감소 (mmHg)
  THIAZIDE: { sbp: 8.8, dbp: 4.4, k: 0.22 },
  BETA_BLOCKER: { sbp: 9.2, dbp: 6.7, k: 0.22 },
  ACEI: { sbp: 8.5, dbp: 4.7, k: 0.22 },
  ARB: { sbp: 10.3, dbp: 5.7, k: 0.22 },
  CCB: { sbp: 8.8, dbp: 5.9, k: 0.22 },
};

export const glucoseEffects: Partial<
  Record<DrugClass, { hba1c: number; fpg: number; k: number }>
> = {
  // [SHER][HIR] 단독요법 평균 HbA1c 감소(%p)와 공복혈당 감소(mg/dL), 표준 하루 용량 기준
  METFORMIN: { hba1c: 1.1, fpg: 30, k: 0.3 },
  SULFONYLUREA: { hba1c: 1.0, fpg: 30, k: 0.25 },
  DPP4: { hba1c: 0.65, fpg: 18, k: 0.1 },
  SGLT2: { hba1c: 0.65, fpg: 25, k: 0.1 },
  TZD: { hba1c: 0.9, fpg: 30, k: 0.25 },
};

/**
 * 여러 계열을 함께 쓰면 뒤에 더해지는 약일수록 추가 감소폭이 작다 (혈당은 기저치가 낮아질수록 효과 감소).
 * 효과가 큰 순서로 정렬해 가중치를 곱한다. 혈압약은 [LAW]에 따라 대체로 더해지므로 1.0.
 */
export const combinationWeights = {
  BLOOD_PRESSURE: [1, 1, 0.9, 0.8],
  GLUCOSE: [1, 0.8, 0.65, 0.5],
} as const;

/** [CTT] 스타틴 성분별 하루 용량(mg) → LDL 감소율 (log 용량 사이 선형 보간) */
export const statinLdlReduction: Record<string, [number, number][]> = {
  ATORVASTATIN: [
    [10, 0.37],
    [20, 0.43],
    [40, 0.49],
    [80, 0.55],
  ],
  ROSUVASTATIN: [
    [5, 0.38],
    [10, 0.43],
    [20, 0.48],
    [40, 0.53],
  ],
  SIMVASTATIN: [
    [10, 0.27],
    [20, 0.32],
    [40, 0.37],
    [80, 0.42],
  ],
  PRAVASTATIN: [
    [10, 0.2],
    [20, 0.24],
    [40, 0.29],
    [80, 0.33],
  ],
  PITAVASTATIN: [
    [1, 0.32],
    [2, 0.38],
    [4, 0.43],
  ],
};

/** 스타틴 외 지질약: 표준 용량 기준 LDL·중성지방 감소율, HDL 증가율 */
export const lipidEffects: Partial<
  Record<DrugClass, { ldl: number; tg: number; hdl: number; k: number }>
> = {
  STATIN: { ldl: 0, tg: 0.15, hdl: 0.05, k: 0 }, // LDL은 statinLdlReduction 사용
  EZETIMIBE: { ldl: 0.22, tg: 0.05, hdl: 0.02, k: 0 }, // [EZE]
  FIBRATE: { ldl: 0.1, tg: 0.35, hdl: 0.12, k: 0.1 }, // [FIB]
  OMEGA3: { ldl: 0, tg: 0.27, hdl: 0.03, k: 0.4 }, // [OM3] 2g ≈ 절반 효과
};

/** 여러 지질약 병용 시 감소율은 곱으로 합친다: 1 - Π(1 - r). 추정치의 상한 */
export const MAX_LIPID_REDUCTION = { ldl: 0.75, tg: 0.6 } as const;
/** HDL 상승 합계 상한 */
export const MAX_HDL_INCREASE = 0.25;
