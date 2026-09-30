/**
 * 생체나이 엔진 — 순수 함수 (같은 입력 → 같은 결과, DB·네트워크·LLM 의존 없음)
 *
 * 1) 건강검진 지표를 같은 성별·나이 평균과 비교해 영역별 생체나이(간·혈관·혈압·신장·당뇨·빈혈)를 구한다.
 * 2) 혈압약·당뇨약·고지혈증약은 복합제를 단일 성분으로 나눠 하루 용량을 계산하고,
 *    평균 약효만큼 "약을 먹지 않았다면"의 수치를 추정해 생체나이를 보정한다.
 * 3) 대사증후군 5개 요소로 대사증후군 나이를 구하고, 그 나이의 진행 속도로
 *    판정 기준(5개 중 3개 이상)에 닿는 시점을 추정한다.
 */
import { inferManagedConditions } from "@/domain/analysis/snapshot";
import type { MetricCode } from "@/domain/health-snapshot/metrics";
import type { Therapy } from "@/domain/medication/catalog";
import {
  computeMedicationEffect,
  estimateUntreated,
  type MedicationEffect,
} from "./medication";
import {
  BIO_AGE_VERSION,
  METABOLIC_CRITERIA,
  METABOLIC_WEIGHTS,
  ORGAN_GAP_RANGE,
  PROJECTION,
  referenceMean,
  references,
  referenceSpread,
  UNFAVORABLE_CAP_YEARS,
  type ReferenceMetric,
} from "./rules/reference";
import type {
  BioAgeInput,
  BioAgeResult,
  MetabolicFactor,
  MetabolicFactorCode,
  MetabolicProjection,
  MetricAge,
  OrganAge,
  OrganCode,
} from "./types";

type Sex = "MALE" | "FEMALE";
type Metrics = Partial<Record<MetricCode, number>>;

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** 영역별 사용 지표와 가중치, 관련 약 */
export const ORGANS: Record<
  OrganCode,
  {
    weights: Partial<Record<ReferenceMetric, number>>;
    /** 가중치 합 중 이만큼 이상 입력되어야 계산 */
    minCoverage: number;
    therapy: Therapy | null;
  }
> = {
  LIVER: {
    weights: { ALT: 0.4, GGT: 0.4, AST: 0.2 },
    minCoverage: 0.4,
    therapy: null,
  },
  VASCULAR: {
    weights: {
      LDL: 0.35,
      HDL: 0.25,
      TRIGLYCERIDE: 0.2,
      TOTAL_CHOLESTEROL: 0.2,
    },
    minCoverage: 0.45,
    therapy: "LIPID",
  },
  BLOOD_PRESSURE: {
    weights: { SBP: 0.6, DBP: 0.4 },
    minCoverage: 0.6,
    therapy: "BLOOD_PRESSURE",
  },
  KIDNEY: { weights: { EGFR: 1 }, minCoverage: 1, therapy: null },
  DIABETES: {
    weights: { FASTING_GLUCOSE: 0.5, HBA1C: 0.5 },
    minCoverage: 0.5,
    therapy: "GLUCOSE",
  },
  ANEMIA: { weights: { HEMOGLOBIN: 1 }, minCoverage: 1, therapy: null },
  METABOLIC: { weights: METABOLIC_WEIGHTS, minCoverage: 0.6, therapy: null },
};

/** 지표 하나를 같은 성별·나이 평균과 비교한 나이 차이(세) */
export function metricGapYears(
  metric: ReferenceMetric,
  value: number,
  sex: Sex,
  age: number,
): number {
  const ref = references[metric];
  const mean = referenceMean(metric, sex, age);
  const spread = referenceSpread(metric, sex, age);
  const z =
    ref.scale === "LOG"
      ? Math.log(value / mean) / Math.log(spread)
      : (value - mean) / spread;
  const worse = ref.direction === "HIGHER_WORSE" ? z : -z;
  return clamp(
    worse * ref.yearsPerSd,
    -ref.favorableCapYears,
    UNFAVORABLE_CAP_YEARS,
  );
}

/** CKD-EPI 2021 (인종 계수 없음) — 크레아티닌만 있을 때 eGFR 계산 */
export function egfrFromCreatinine(
  creatinine: number,
  sex: Sex,
  age: number,
): number {
  const [k, a, f] = sex === "FEMALE" ? [0.7, -0.241, 1.012] : [0.9, -0.302, 1];
  const r = creatinine / k;
  return Math.round(
    142 * Math.min(r, 1) ** a * Math.max(r, 1) ** -1.2 * 0.9938 ** age * f,
  );
}

function evaluateOrgan(
  organ: OrganCode,
  input: { sex: Sex; age: number; measured: Metrics; adjusted: Metrics },
  derived: Set<MetricCode>,
  medication: OrganAge["medication"],
): OrganAge {
  const def = ORGANS[organ];
  const { sex, age } = input;
  const metrics: MetricAge[] = [];
  for (const [code, weight] of Object.entries(def.weights) as [
    ReferenceMetric,
    number,
  ][]) {
    const value = input.measured[code];
    if (value === undefined) continue;
    const adjustedValue = input.adjusted[code] ?? value;
    const gapYears = round1(metricGapYears(code, value, sex, age));
    metrics.push({
      metric: code,
      value,
      ...(adjustedValue !== value ? { adjustedValue } : {}),
      referenceMean: round1(referenceMean(code, sex, age)),
      gapYears,
      adjustedGapYears:
        adjustedValue !== value
          ? round1(metricGapYears(code, adjustedValue, sex, age))
          : gapYears,
      weight,
      ...(derived.has(code) ? { derived: true } : {}),
    });
  }
  const coverage = metrics.reduce((s, m) => s + m.weight, 0);
  const base = { organ, therapy: def.therapy, medication, metrics };
  if (coverage + 1e-9 < def.minCoverage) {
    return {
      ...base,
      status: "DATA_INSUFFICIENT",
      measuredAge: null,
      measuredGap: null,
      adjustedAge: null,
      adjustedGap: null,
    };
  }
  const gap = (pick: (m: MetricAge) => number) =>
    round1(
      clamp(
        metrics.reduce((s, m) => s + pick(m) * m.weight, 0) / coverage,
        ORGAN_GAP_RANGE.min,
        ORGAN_GAP_RANGE.max,
      ),
    );
  const measuredGap = gap((m) => m.gapYears);
  const adjustedGap = gap((m) => m.adjustedGapYears);
  return {
    ...base,
    status: "OK",
    measuredGap,
    measuredAge: round1(age + measuredGap),
    adjustedGap,
    adjustedAge: round1(age + adjustedGap),
  };
}

// ─────────────── 대사증후군 요소 ───────────────

type FactorState = {
  factor: MetabolicFactorCode;
  /** 추정에 쓰는 값 (약 보정) */
  values: Partial<Record<ReferenceMetric, number>>;
  metByTherapy: boolean;
};

function factorMet(f: FactorState, sex: Sex): boolean {
  if (f.metByTherapy) return true;
  const v = f.values;
  const c = METABOLIC_CRITERIA;
  switch (f.factor) {
    case "WAIST":
      return v.WAIST !== undefined && v.WAIST >= c.waist[sex];
    case "BLOOD_PRESSURE":
      return (
        (v.SBP !== undefined && v.SBP >= c.sbp) ||
        (v.DBP !== undefined && v.DBP >= c.dbp)
      );
    case "GLUCOSE":
      return (
        v.FASTING_GLUCOSE !== undefined && v.FASTING_GLUCOSE >= c.fastingGlucose
      );
    case "TRIGLYCERIDE":
      return v.TRIGLYCERIDE !== undefined && v.TRIGLYCERIDE >= c.triglyceride;
    case "HDL":
      return v.HDL !== undefined && v.HDL < c.hdl[sex];
  }
}

function criterionText(factor: MetabolicFactorCode, sex: Sex): string {
  const c = METABOLIC_CRITERIA;
  switch (factor) {
    case "WAIST":
      return `${c.waist[sex]}cm 이상`;
    case "BLOOD_PRESSURE":
      return `${c.sbp}/${c.dbp}mmHg 이상`;
    case "GLUCOSE":
      return `${c.fastingGlucose}mg/dL 이상`;
    case "TRIGLYCERIDE":
      return `${c.triglyceride}mg/dL 이상`;
    case "HDL":
      return `${c.hdl[sex]}mg/dL 미만`;
  }
}

/** 성별 평균 곡선에서 나빠지는 방향의 1년 변화 (LOG 지표는 비율) */
function annualWorsening(
  metric: keyof typeof PROJECTION.minAnnualDrift,
  sex: Sex,
  curveAge: number,
): number {
  const ref = references[metric];
  const now = referenceMean(metric, sex, curveAge);
  const next = referenceMean(metric, sex, curveAge + 1);
  const slope =
    ref.scale === "LOG"
      ? next / now - 1
      : ref.direction === "HIGHER_WORSE"
        ? next - now
        : now - next;
  return Math.max(slope, PROJECTION.minAnnualDrift[metric]);
}

/** 1년치 진행: 대사 나이 곡선 위치 curveAge에서 pace배 속도로 */
function stepFactor(f: FactorState, sex: Sex, curveAge: number, pace: number) {
  const v = f.values;
  for (const metric of Object.keys(v) as (keyof typeof v)[]) {
    if (!(metric in PROJECTION.minAnnualDrift)) continue;
    const m = metric as keyof typeof PROJECTION.minAnnualDrift;
    const w = annualWorsening(m, sex, curveAge) * pace;
    const ref = references[m];
    if (ref.scale === "LOG") v[m] = v[m]! * (1 + w);
    else if (ref.direction === "HIGHER_WORSE") v[m] = v[m]! + w;
    else v[m] = v[m]! - w;
  }
}

function buildFactors(
  sex: Sex,
  measured: Metrics,
  adjusted: Metrics,
  therapies: Set<Therapy>,
  effect: MedicationEffect,
): { states: FactorState[]; factors: Omit<MetabolicFactor, "yearsToMeet">[] } {
  // 분석 엔진(evaluateMetabolic)과 같이 콜레스테롤 관리 약 복용 시 중성지방 요소는 해당으로 본다
  const tgTherapy = therapies.has("LIPID");
  const hdlTherapy = effect.ingredients.some((i) => i.drugClass === "FIBRATE");
  const pick = (codes: ReferenceMetric[]) =>
    Object.fromEntries(
      codes
        .filter((c) => adjusted[c] !== undefined)
        .map((c) => [c, adjusted[c]]),
    ) as Partial<Record<ReferenceMetric, number>>;

  const defs: [MetabolicFactorCode, ReferenceMetric[], boolean][] = [
    ["WAIST", ["WAIST"], false],
    ["BLOOD_PRESSURE", ["SBP", "DBP"], therapies.has("BLOOD_PRESSURE")],
    ["GLUCOSE", ["FASTING_GLUCOSE"], therapies.has("GLUCOSE")],
    ["TRIGLYCERIDE", ["TRIGLYCERIDE"], tgTherapy],
    ["HDL", ["HDL"], hdlTherapy],
  ];
  const states = defs.map(([factor, codes, metByTherapy]) => ({
    factor,
    values: pick(codes),
    metByTherapy,
  }));
  const factors = defs.map(([factor, codes], i) => {
    const [a, b] = codes;
    const met = factorMet(states[i], sex);
    return {
      factor,
      value: measured[a] ?? null,
      adjustedValue: adjusted[a] ?? null,
      ...(b
        ? { value2: measured[b] ?? null, adjustedValue2: adjusted[b] ?? null }
        : {}),
      criterion: criterionText(factor, sex),
      met,
      metByTherapy: states[i].metByTherapy,
    };
  });
  return { states, factors };
}

function projectMetabolic(
  sex: Sex,
  age: number,
  metabolicAge: number,
  states: FactorState[],
): { yearsToMeet: (number | null)[]; projection: MetabolicProjection } {
  const available = states.filter(
    (s) => s.metByTherapy || Object.keys(s.values).length > 0,
  );
  const metNow = states.map((s) => factorMet(s, sex));
  const yearsToMeet: (number | null)[] = metNow.map((m) => (m ? 0 : null));
  if (available.length < METABOLIC_CRITERIA.minFactors) {
    return { yearsToMeet, projection: { status: "DATA_INSUFFICIENT" } };
  }

  const pace = clamp(
    1 + (metabolicAge - age) / PROJECTION.paceDivisor,
    PROJECTION.paceRange.min,
    PROJECTION.paceRange.max,
  );
  const horizon = Math.min(
    PROJECTION.horizonYears,
    Math.max(0, PROJECTION.maxAge - Math.floor(age)),
  );
  const sim = states.map((s) => ({ ...s, values: { ...s.values } }));
  for (let t = 1; t <= horizon; t++) {
    sim.forEach((s, i) => {
      if (yearsToMeet[i] !== null || Object.keys(s.values).length === 0) return;
      stepFactor(s, sex, metabolicAge + (t - 1) * pace, pace);
      if (factorMet(s, sex)) yearsToMeet[i] = t;
    });
  }

  const metCount = metNow.filter(Boolean).length;
  if (metCount >= METABOLIC_CRITERIA.minFactors) {
    return { yearsToMeet, projection: { status: "ALREADY_MET", metCount } };
  }
  const sorted = yearsToMeet
    .map((y, i) => ({ y, factor: states[i].factor }))
    .filter(
      (x): x is { y: number; factor: MetabolicFactorCode } => x.y !== null,
    )
    .sort((a, b) => a.y - b.y);
  const onset = sorted[METABOLIC_CRITERIA.minFactors - 1];
  if (!onset) {
    return {
      yearsToMeet,
      projection: { status: "NOT_WITHIN_HORIZON", horizonYears: horizon },
    };
  }
  return {
    yearsToMeet,
    projection: {
      status: "PROJECTED",
      yearsUntil: onset.y,
      atAge: Math.floor(age) + onset.y,
      atMetabolicAge: round1(metabolicAge + onset.y * pace),
      factors: sorted.filter((x) => x.y <= onset.y).map((x) => x.factor),
    },
  };
}

export function calculateBioAge(input: BioAgeInput): BioAgeResult {
  const { sex, age } = input;
  const measured: Metrics = { ...input.metrics };
  const derived = new Set<MetricCode>();
  if (measured.EGFR === undefined && measured.CREATININE !== undefined) {
    measured.EGFR = egfrFromCreatinine(measured.CREATININE, sex, age);
    derived.add("EGFR");
  }

  const effect = computeMedicationEffect(input.medications);
  const adjusted = estimateUntreated(measured, effect);
  const therapies = new Set<Therapy>([
    ...inferManagedConditions(input.medications.map((m) => m.purpose)),
    ...effect.quantified,
  ]);
  const quantified = new Set(effect.quantified);
  const medStatus = (t: Therapy | null): OrganAge["medication"] =>
    t === null || !therapies.has(t)
      ? "NONE"
      : quantified.has(t)
        ? "QUANTIFIED"
        : "UNQUANTIFIED";

  const ctx = { sex, age, measured, adjusted };
  const organs = (Object.keys(ORGANS) as OrganCode[]).map((organ) => {
    if (organ !== "METABOLIC")
      return evaluateOrgan(
        organ,
        ctx,
        derived,
        medStatus(ORGANS[organ].therapy),
      );
    const status: OrganAge["medication"] =
      quantified.size > 0
        ? "QUANTIFIED"
        : therapies.size > 0
          ? "UNQUANTIFIED"
          : "NONE";
    return evaluateOrgan(organ, ctx, derived, status);
  });

  const scored = organs.filter(
    (o) => o.organ !== "METABOLIC" && o.adjustedGap !== null,
  );
  const overallGap = scored.length
    ? round1(scored.reduce((s, o) => s + o.adjustedGap!, 0) / scored.length)
    : null;

  const { states, factors } = buildFactors(
    sex,
    measured,
    adjusted,
    therapies,
    effect,
  );
  const metabolicOrgan = organs.find((o) => o.organ === "METABOLIC")!;
  const { yearsToMeet, projection } = projectMetabolic(
    sex,
    age,
    metabolicOrgan.adjustedAge ?? age,
    states,
  );

  const { ingredients, quantified: _q, ...lowering } = effect;
  return {
    version: BIO_AGE_VERSION,
    sex,
    chronologicalAge: age,
    organs,
    overall:
      overallGap === null
        ? null
        : {
            age: round1(age + overallGap),
            gap: overallGap,
            organCount: scored.length,
          },
    medications: {
      ingredients,
      effect: lowering,
      therapies: (["BLOOD_PRESSURE", "GLUCOSE", "LIPID"] as const).filter((t) =>
        therapies.has(t),
      ),
      unquantified: (["BLOOD_PRESSURE", "GLUCOSE", "LIPID"] as const).filter(
        (t) => therapies.has(t) && !quantified.has(t),
      ),
    },
    metabolic: {
      factors: factors.map((f, i) => ({ ...f, yearsToMeet: yearsToMeet[i] })),
      metCount: factors.filter((f) => f.met).length,
      availableCount: states.filter(
        (s) => s.metByTherapy || Object.keys(s.values).length > 0,
      ).length,
      projection,
    },
  };
}
