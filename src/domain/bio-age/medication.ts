/**
 * 복용약 → "약을 먹지 않았다면" 추정 수치
 * 약을 평가·권유하지 않는다. 생체나이를 약 효과만큼 보정해 보여주기 위한 추정이다.
 */
import {
  DRUG_CLASS_THERAPY,
  INGREDIENTS,
  splitIntoIngredients,
  type DrugClass,
  type Therapy,
} from "@/domain/medication/catalog";
import type { MetricCode } from "@/domain/health-snapshot/metrics";
import {
  bpEffects,
  combinationWeights,
  DOSE_FACTOR_MIN,
  glucoseEffects,
  lipidEffects,
  MAX_HDL_INCREASE,
  MAX_LIPID_REDUCTION,
  statinLdlReduction,
} from "./rules/medication-effects";

export type MedicationInput = {
  drugCode?: string | null;
  dailyTablets?: number | null;
};

export type IngredientUse = {
  ingredient: string;
  name: string;
  drugClass: DrugClass;
  therapy: Therapy;
  dailyMg: number;
  /** 표준 하루 용량 대비 비율 */
  doseRatio: number;
};

export type MedicationEffect = {
  ingredients: IngredientUse[];
  /** 평균적으로 기대되는 변화량 (모두 양수 = 낮춘 양, hdlPct만 올린 비율) */
  sbp: number;
  dbp: number;
  hba1c: number;
  fpg: number;
  ldlPct: number;
  tgPct: number;
  hdlPct: number;
  /** 성분·함량이 확인되어 보정한 목적 */
  quantified: Therapy[];
};

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** 표준용량 대비 용량 비율 → 효과 계수 */
export function doseFactor(ratio: number, k: number): number {
  if (k === 0 || !(ratio > 0)) return 1;
  return clamp(1 + k * Math.log2(ratio), DOSE_FACTOR_MIN, 1 + 2 * k);
}

/** 스타틴 하루 용량 → LDL 감소율 (log 용량 보간, 범위 밖은 2배당 6%p) */
export function statinReduction(ingredient: string, dailyMg: number): number {
  const table = statinLdlReduction[ingredient];
  if (!table || !(dailyMg > 0)) return 0;
  const x = Math.log2(dailyMg);
  const [lo, hi] = [table[0], table[table.length - 1]];
  if (x <= Math.log2(lo[0]))
    return clamp(lo[1] - 0.06 * (Math.log2(lo[0]) - x), 0.1, 0.65);
  if (x >= Math.log2(hi[0]))
    return clamp(hi[1] + 0.06 * (x - Math.log2(hi[0])), 0.1, 0.65);
  for (let i = 0; i < table.length - 1; i++) {
    const [d0, r0] = table[i];
    const [d1, r1] = table[i + 1];
    if (dailyMg <= d1) {
      const t = (x - Math.log2(d0)) / (Math.log2(d1) - Math.log2(d0));
      return r0 + (r1 - r0) * t;
    }
  }
  return hi[1];
}

/** 효과가 큰 순서로 병용 가중치를 곱해 더한다 */
function combine(values: number[], weights: readonly number[]): number {
  return [...values]
    .sort((a, b) => b - a)
    .reduce(
      (sum, v, i) => sum + v * (weights[i] ?? weights[weights.length - 1]),
      0,
    );
}

export function computeMedicationEffect(
  meds: MedicationInput[],
): MedicationEffect {
  const ingredients: IngredientUse[] = splitIntoIngredients(meds).map((d) => {
    const ing = INGREDIENTS[d.ingredient];
    return {
      ingredient: d.ingredient,
      name: ing.name,
      drugClass: ing.drugClass,
      therapy: DRUG_CLASS_THERAPY[ing.drugClass],
      dailyMg: d.dailyMg,
      doseRatio: round(d.dailyMg / ing.standardDailyMg, 2),
    };
  });

  // 같은 계열 두 성분(예: ARB 2종)은 계열 효과를 한 번만, 용량 비율은 더해서 본다
  const byClass = new Map<DrugClass, number>();
  for (const i of ingredients)
    byClass.set(i.drugClass, (byClass.get(i.drugClass) ?? 0) + i.doseRatio);

  const sbp: number[] = [];
  const dbp: number[] = [];
  const hba1c: number[] = [];
  const fpg: number[] = [];
  for (const [cls, ratio] of byClass) {
    const bp = bpEffects[cls];
    if (bp) {
      const f = doseFactor(ratio, bp.k);
      sbp.push(bp.sbp * f);
      dbp.push(bp.dbp * f);
    }
    const gl = glucoseEffects[cls];
    if (gl) {
      const f = doseFactor(ratio, gl.k);
      hba1c.push(gl.hba1c * f);
      fpg.push(gl.fpg * f);
    }
  }

  let ldlRemain = 1;
  let tgRemain = 1;
  let hdlUp = 0;
  for (const i of ingredients) {
    const eff = lipidEffects[i.drugClass];
    if (!eff) continue;
    const f = doseFactor(i.doseRatio, eff.k);
    const ldl =
      i.drugClass === "STATIN"
        ? statinReduction(i.ingredient, i.dailyMg)
        : eff.ldl * f;
    ldlRemain *= 1 - ldl;
    tgRemain *= 1 - eff.tg * f;
    hdlUp += eff.hdl * f;
  }

  const quantified = (["BLOOD_PRESSURE", "GLUCOSE", "LIPID"] as const).filter(
    (t) => ingredients.some((i) => i.therapy === t),
  );

  return {
    ingredients,
    sbp: round(combine(sbp, combinationWeights.BLOOD_PRESSURE)),
    dbp: round(combine(dbp, combinationWeights.BLOOD_PRESSURE)),
    hba1c: round(combine(hba1c, combinationWeights.GLUCOSE), 2),
    fpg: round(combine(fpg, combinationWeights.GLUCOSE)),
    ldlPct: round(Math.min(1 - ldlRemain, MAX_LIPID_REDUCTION.ldl), 3),
    tgPct: round(Math.min(1 - tgRemain, MAX_LIPID_REDUCTION.tg), 3),
    hdlPct: round(Math.min(hdlUp, MAX_HDL_INCREASE), 3),
    quantified,
  };
}

/**
 * 혈당약 효과는 측정 혈당이 정상에 가까울수록 작게 본다
 * (임상시험 평균 효과는 HbA1c 8% 전후에서 측정된 값) — HbA1c 6.0 → 50%, 8.0 이상 → 100%
 */
export function glucoseEffectScale(
  hba1c: number | undefined,
  fpg: number | undefined,
): number {
  const a1c = hba1c ?? (fpg !== undefined ? (fpg + 46.7) / 28.7 : undefined); // [ADAG] 역산
  if (a1c === undefined) return 1;
  return clamp(0.5 + 0.25 * (a1c - 6), 0.5, 1);
}

/** 측정값 + 약 효과 → 약을 먹지 않았다면의 추정 수치. 약과 관련 없는 지표는 그대로 */
export function estimateUntreated(
  metrics: Partial<Record<MetricCode, number>>,
  effect: MedicationEffect,
): Partial<Record<MetricCode, number>> {
  const out = { ...metrics };
  const add = (code: MetricCode, delta: number, d = 0) => {
    const v = metrics[code];
    if (v !== undefined && delta !== 0) out[code] = round(v + delta, d);
  };
  add("SBP", effect.sbp);
  add("DBP", effect.dbp);

  const g = glucoseEffectScale(metrics.HBA1C, metrics.FASTING_GLUCOSE);
  add("HBA1C", effect.hba1c * g, 1);
  add("FASTING_GLUCOSE", effect.fpg * g);

  if (metrics.LDL !== undefined && effect.ldlPct > 0) {
    const ldl = metrics.LDL / (1 - effect.ldlPct);
    out.LDL = round(ldl, 0);
    // 총콜레스테롤은 LDL이 늘어난 만큼 함께 늘어난다고 본다
    if (metrics.TOTAL_CHOLESTEROL !== undefined)
      out.TOTAL_CHOLESTEROL = round(
        metrics.TOTAL_CHOLESTEROL + (ldl - metrics.LDL),
        0,
      );
  }
  if (metrics.TRIGLYCERIDE !== undefined && effect.tgPct > 0)
    out.TRIGLYCERIDE = round(metrics.TRIGLYCERIDE / (1 - effect.tgPct), 0);
  if (metrics.HDL !== undefined && effect.hdlPct > 0)
    out.HDL = round(metrics.HDL / (1 + effect.hdlPct), 0);
  return out;
}
