/**
 * 운동 반영 생체나이 — 순수 함수 (DB·네트워크 의존 없음)
 *
 * 1) 매일 기록한 걸음수·운동(종류·강도·시간)을 최근 기간 평균으로 모아,
 *    평소(문진)보다 늘어난 운동량을 "주당 중강도 유산소 시간"·근력·정적 근력 시간으로 환산한다.
 * 2) 무작위배정 임상시험 메타분석의 평균 효과로 검진 수치 변화(혈압·혈당·지질·허리둘레·ALT)를 추정한다.
 * 3) 기록을 시작한 뒤 지난 기간만큼 효과가 쌓인다고 보고(약 12주에 95%),
 *    변화한 수치를 생체나이 엔진에 다시 넣어 "운동 반영 예상 생체나이"를 구한다.
 *
 * 판정은 하지 않는다. 기록을 하지 않은 날은 평소와 같다고 본다 (늘어난 운동량 0).
 * 운동량이 평소보다 줄어든 경우의 악화는 반영하지 않는다 — 다음 검진에서 확인한다.
 */
import { METRICS, type MetricCode } from "@/domain/health-snapshot/metrics";
import { calculateBioAge } from "./engine";
import {
  AEROBIC_FULL_DOSE_MIN,
  AEROBIC_MAX_FACTOR,
  ALT_EFFECT,
  BASELINE_STRENGTH_MIN,
  BP_CLASS,
  BP_MAX_REDUCTION,
  bpEffects,
  DEFAULT_BASELINE_STEPS,
  GLUCOSE_SCALE,
  HBA1C_EFFECT,
  HDL_EFFECT,
  ISOMETRIC_FULL_DOSE_MIN,
  LIPID_EFFECTS,
  MGDL_PER_HBA1C,
  RAMP_MAX_WEEKS,
  RAMP_TAU_WEEKS,
  STEPS_CREDIT,
  STEPS_PER_MODERATE_MIN,
  STRENGTH_FULL_DOSE_MIN,
  WAIST_EFFECT,
  WINDOW_DAYS,
  type BpClass,
} from "./rules/activity-effects";
import { METABOLIC_CRITERIA } from "./rules/reference";
import type { BioAgeInput, BioAgeResult, OrganCode } from "./types";

export const ACTIVITY_MODEL_VERSION = "activity-v1";

// ─────────────── 기록 형식 ───────────────

export const EXERCISE_TYPES = [
  "RUNNING",
  "CYCLING",
  "SWIMMING",
  "HIKING",
  "BALL_SPORTS",
  "DANCE",
  "CARDIO_MACHINE",
  "OTHER_AEROBIC",
  "STRENGTH",
  "ISOMETRIC",
  "FLEXIBILITY",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export type ExerciseCategory =
  "AEROBIC" | "STRENGTH" | "ISOMETRIC" | "FLEXIBILITY";

export const EXERCISE_CATEGORY: Record<ExerciseType, ExerciseCategory> = {
  RUNNING: "AEROBIC",
  CYCLING: "AEROBIC",
  SWIMMING: "AEROBIC",
  HIKING: "AEROBIC",
  BALL_SPORTS: "AEROBIC",
  DANCE: "AEROBIC",
  CARDIO_MACHINE: "AEROBIC",
  OTHER_AEROBIC: "AEROBIC",
  STRENGTH: "STRENGTH",
  ISOMETRIC: "ISOMETRIC",
  FLEXIBILITY: "FLEXIBILITY",
};

export const INTENSITIES = ["LIGHT", "MODERATE", "VIGOROUS"] as const;
export type Intensity = (typeof INTENSITIES)[number];

/**
 * [WHO] 고강도 1분 = 중강도 2분. 가벼운 운동은 수치 변화 근거가 부족해 유산소 시간에 넣지 않는다
 * (걸음수로는 반영된다).
 */
export const INTENSITY_FACTOR: Record<Intensity, number> = {
  LIGHT: 0,
  MODERATE: 1,
  VIGOROUS: 2,
};

export type ExerciseSession = {
  type: ExerciseType;
  intensity: Intensity;
  minutes: number;
};

export type DailyActivity = {
  /** YYYY-MM-DD (한국 날짜) */
  date: string;
  steps: number | null;
  sessions: ExerciseSession[];
};

/** 평소 활동량 (건강분석 문진) */
export type ActivityBaseline = {
  dailySteps?: number;
  aerobicMinPerWeek?: number;
  strengthTraining?: boolean;
};

// ─────────────── 1) 기록 요약 ───────────────

export type ActivitySummary = {
  /** 평균을 낸 기간(일): 기록 시작 후 지난 날수, 최대 WINDOW_DAYS */
  windowDays: number;
  loggedDays: number;
  /** 기록 시작 후 지난 주 수 (최대 RAMP_MAX_WEEKS) */
  weeksSinceStart: number;
  /** 걸음수를 기록한 날의 평균 */
  avgSteps: number | null;
  /** 기간 평균 주당 시간 (분) */
  weekly: {
    /** 중강도 환산 유산소 (고강도 ×2, 가벼운 운동 제외, 걸음수 제외) */
    aerobicMin: number;
    strengthMin: number;
    isometricMin: number;
  };
  baseline: { steps: number; aerobicMin: number; strengthMin: number };
  /** 평소보다 늘어난 주당 운동량 (0 이상) */
  increase: {
    /** 늘어난 걸음수를 중강도 시간으로 환산한 값 포함 */
    aerobicMin: number;
    fromStepsMin: number;
    strengthMin: number;
    isometricMin: number;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function summarizeActivity(
  logs: DailyActivity[],
  today: string,
  baseline: ActivityBaseline,
): ActivitySummary | null {
  const t = dayNumber(today);
  const past = logs.filter((l) => dayNumber(l.date) <= t);
  if (past.length === 0) return null;
  const first = Math.min(...past.map((l) => dayNumber(l.date)));
  const windowDays = Math.min(WINDOW_DAYS, t - first + 1);
  const inWindow = past.filter((l) => t - dayNumber(l.date) < windowDays);

  const base = {
    steps: baseline.dailySteps ?? DEFAULT_BASELINE_STEPS,
    aerobicMin: baseline.aerobicMinPerWeek ?? 0,
    strengthMin: baseline.strengthTraining ? BASELINE_STRENGTH_MIN : 0,
  };

  let aerobic = 0;
  let strength = 0;
  let isometric = 0;
  let extraSteps = 0;
  let stepSum = 0;
  let stepDays = 0;
  for (const day of inWindow) {
    for (const s of day.sessions) {
      const cat = EXERCISE_CATEGORY[s.type];
      if (cat === "AEROBIC")
        aerobic += s.minutes * INTENSITY_FACTOR[s.intensity];
      else if (cat === "STRENGTH") strength += s.minutes;
      else if (cat === "ISOMETRIC") isometric += s.minutes;
    }
    if (day.steps !== null) {
      stepSum += day.steps;
      stepDays += 1;
      extraSteps += day.steps - base.steps;
    }
  }
  const perWeek = (total: number) => (total / windowDays) * 7;
  const weekly = {
    aerobicMin: round1(perWeek(aerobic)),
    strengthMin: round1(perWeek(strength)),
    isometricMin: round1(perWeek(isometric)),
  };
  // 기록한 날만 평소 대비로 계산하고, 기록하지 않은 날은 평소와 같다고 본다
  const loggedShare = inWindow.length / windowDays;
  const fromStepsMin = Math.max(
    0,
    perWeek(extraSteps) * (STEPS_CREDIT / STEPS_PER_MODERATE_MIN),
  );
  const aerobicIncrease = Math.max(
    0,
    weekly.aerobicMin - base.aerobicMin * loggedShare,
  );
  return {
    windowDays,
    loggedDays: inWindow.length,
    weeksSinceStart: round1(Math.min(RAMP_MAX_WEEKS, (t - first + 1) / 7)),
    avgSteps: stepDays ? Math.round(stepSum / stepDays) : null,
    weekly,
    baseline: base,
    increase: {
      aerobicMin: round1(aerobicIncrease + fromStepsMin),
      fromStepsMin: round1(fromStepsMin),
      strengthMin: round1(
        Math.max(0, weekly.strengthMin - base.strengthMin * loggedShare),
      ),
      isometricMin: weekly.isometricMin,
    },
  };
}

// ─────────────── 2) 수치 변화 추정 ───────────────

/** 유산소 기준량 대비 비율: 주 150분 = 1, 그 이상은 절반 속도로 늘어 주 300분에서 1.5 */
export function aerobicFactor(weeklyMin: number): number {
  const x = weeklyMin / AEROBIC_FULL_DOSE_MIN;
  return x <= 1
    ? Math.max(0, x)
    : Math.min(AEROBIC_MAX_FACTOR, 1 + (x - 1) / 2);
}

/** 기록 시작 후 지난 주 수에 따라 효과가 쌓이는 비율 */
export function rampFraction(weeks: number): number {
  return 1 - Math.exp(-Math.max(0, weeks) / RAMP_TAU_WEEKS);
}

function bpClassOf(sbp?: number, dbp?: number): BpClass {
  const c = BP_CLASS;
  if ((sbp ?? 0) >= c.hypertensive.sbp || (dbp ?? 0) >= c.hypertensive.dbp)
    return "HYPERTENSIVE";
  if (
    (sbp ?? 0) >= c.prehypertensive.sbp ||
    (dbp ?? 0) >= c.prehypertensive.dbp
  )
    return "PREHYPERTENSIVE";
  return "NORMAL";
}

/** 혈당 효과 비율: 당뇨 범위에서 100%, 정상 범위로 갈수록 작아진다 (가정) */
export function glucoseResponse(
  hba1c: number | undefined,
  fpg: number | undefined,
): number {
  const a1c =
    hba1c ?? (fpg !== undefined ? (fpg + 46.7) / MGDL_PER_HBA1C : undefined);
  if (a1c === undefined) return 0;
  const { low, high, min } = GLUCOSE_SCALE;
  return clamp((a1c - low) / (high - low), min, 1);
}

export type MetricChange = {
  metric: MetricCode;
  /** 측정값 → 예상값 */
  from: number;
  to: number;
  delta: number;
  /** 근거 문헌 키 (activity-effects.ts 참고) */
  source: string;
};

export type ActivityDose = {
  aerobic: number;
  strength: number;
  isometric: number;
};

export function doseOf(summary: ActivitySummary): ActivityDose {
  return {
    aerobic: aerobicFactor(summary.increase.aerobicMin),
    strength: clamp(
      summary.increase.strengthMin / STRENGTH_FULL_DOSE_MIN,
      0,
      1,
    ),
    isometric: clamp(
      summary.increase.isometricMin / ISOMETRIC_FULL_DOSE_MIN,
      0,
      1,
    ),
  };
}

/** 여러 운동의 효과: 가장 큰 효과 + 나머지 합의 절반 (가정), 상한 적용 */
function combine(values: number[], cap: number): number {
  const sorted = [...values].sort((a, b) => b - a);
  const [top = 0, ...rest] = sorted;
  return Math.min(cap, top + rest.reduce((s, v) => s + v, 0) / 2);
}

/**
 * 늘어난 운동량(dose)과 진행 비율(ramp)로 검진 수치 변화를 추정한다.
 * 측정하지 않은 지표는 바꾸지 않는다.
 */
export function estimateActivityChanges(
  metrics: Partial<Record<MetricCode, number>>,
  sex: "MALE" | "FEMALE",
  summary: ActivitySummary,
  ramp: number,
): MetricChange[] {
  const dose = doseOf(summary);
  const aerobicMin = summary.increase.aerobicMin;
  const changes: MetricChange[] = [];
  const push = (metric: MetricCode, delta: number, source: string) => {
    const from = metrics[metric];
    if (from === undefined) return;
    const d = METRICS[metric].decimals;
    const f = 10 ** d;
    const to = Math.round((from + delta * ramp) * f) / f;
    if (to !== from)
      changes.push({
        metric,
        from,
        to,
        delta: Math.round((to - from) * f) / f,
        source,
      });
  };

  // 혈압 [CORN][BRAV]
  const cls = bpClassOf(metrics.SBP, metrics.DBP);
  const parts = (["AEROBIC", "STRENGTH", "ISOMETRIC"] as const).map((k) => {
    const amount =
      dose[
        k === "AEROBIC"
          ? "aerobic"
          : k === "STRENGTH"
            ? "strength"
            : "isometric"
      ];
    return {
      sbp: bpEffects[k][cls].sbp * amount,
      dbp: bpEffects[k][cls].dbp * amount,
    };
  });
  push(
    "SBP",
    -combine(
      parts.map((p) => p.sbp),
      BP_MAX_REDUCTION.sbp,
    ),
    "CORN",
  );
  push(
    "DBP",
    -combine(
      parts.map((p) => p.dbp),
      BP_MAX_REDUCTION.dbp,
    ),
    "CORN",
  );

  // 혈당 [UMP][ADAG] — 기저치가 높을수록 효과가 크다
  const g = glucoseResponse(metrics.HBA1C, metrics.FASTING_GLUCOSE);
  // 유산소·근력을 함께 해도 더해지는 효과는 작다 ([UMP] 병행 −0.51 < 유산소 단독 −0.73)
  const a1cDrop =
    g *
    combine(
      [
        HBA1C_EFFECT.AEROBIC * Math.min(1, dose.aerobic),
        HBA1C_EFFECT.STRENGTH * dose.strength,
      ],
      HBA1C_EFFECT.AEROBIC,
    );
  push("HBA1C", -a1cDrop, "UMP");
  push("FASTING_GLUCOSE", -a1cDrop * MGDL_PER_HBA1C, "UMP·ADAG");

  // 지질 [KOD][KELM][KELW]
  if (aerobicMin >= HDL_EFFECT.minWeeklyMin)
    push("HDL", HDL_EFFECT.mgdl * Math.min(1, dose.aerobic), "KOD");
  const a = Math.min(1, dose.aerobic);
  if (sex === "MALE") {
    const l = LIPID_EFFECTS.MALE;
    if (metrics.LDL !== undefined)
      push("LDL", -metrics.LDL * l.ldlPct * a, "KELM");
    if (metrics.TRIGLYCERIDE !== undefined)
      push("TRIGLYCERIDE", -metrics.TRIGLYCERIDE * l.tgPct * a, "KELM");
  } else {
    const l = LIPID_EFFECTS.FEMALE;
    push("LDL", -l.ldlMgdl * a, "KELW");
    push("TRIGLYCERIDE", -l.tgMgdl * a, "KELW");
  }

  // 허리둘레 [JAY] — 과체중 이상에서만
  const overweight =
    (metrics.BMI !== undefined && metrics.BMI >= WAIST_EFFECT.minBmi) ||
    (metrics.WAIST !== undefined &&
      metrics.WAIST >= METABOLIC_CRITERIA.waist[sex]);
  if (overweight)
    push(
      "WAIST",
      -WAIST_EFFECT.cmPer30Min *
        (Math.min(aerobicMin, WAIST_EFFECT.maxWeeklyMin) / 30),
      "JAY",
    );

  // ALT [MAFLD] — ALT가 높은 경우에만
  if (metrics.ALT !== undefined && metrics.ALT > ALT_EFFECT.minAlt)
    push("ALT", -ALT_EFFECT.uL * Math.min(1, dose.aerobic), "MAFLD");

  return changes;
}

// ─────────────── 3) 생체나이 예상 ───────────────

export type OrganChange = {
  organ: OrganCode;
  current: number;
  projected: number;
  /** 음수 = 젊어짐 */
  delta: number;
};

export type ActivityScenario = {
  ramp: number;
  changes: MetricChange[];
  overall: { current: number; projected: number; delta: number } | null;
  organs: OrganChange[];
};

export type ActivityProjection = {
  version: string;
  summary: ActivitySummary;
  dose: ActivityDose;
  /** 지금까지 기록 기준 (효과가 쌓인 만큼) */
  now: ActivityScenario;
  /** 지금처럼 12주 꾸준히 하면 */
  sustained: ActivityScenario;
};

function scenario(
  input: BioAgeInput,
  current: BioAgeResult,
  summary: ActivitySummary,
  ramp: number,
): ActivityScenario {
  const changes = estimateActivityChanges(
    input.metrics,
    input.sex,
    summary,
    ramp,
  );
  const metrics = { ...input.metrics };
  for (const c of changes) metrics[c.metric] = c.to;
  const projected = calculateBioAge({ ...input, metrics });

  const organs: OrganChange[] = [];
  for (const o of projected.organs) {
    const before = current.organs.find((c) => c.organ === o.organ);
    if (
      o.organ === "METABOLIC" ||
      o.adjustedAge === null ||
      before?.adjustedAge === null ||
      before?.adjustedAge === undefined
    )
      continue;
    organs.push({
      organ: o.organ,
      current: before.adjustedAge,
      projected: o.adjustedAge,
      delta: round1(o.adjustedAge - before.adjustedAge),
    });
  }
  return {
    ramp: round1(ramp * 100) / 100,
    changes,
    overall:
      current.overall && projected.overall
        ? {
            current: current.overall.age,
            projected: projected.overall.age,
            delta: round1(projected.overall.age - current.overall.age),
          }
        : null,
    organs,
  };
}

/**
 * 현재 생체나이(검진 기준)에 기록한 활동을 반영한 예상 생체나이.
 * 기록이 없으면 null.
 */
export function projectBioAgeWithActivity(
  input: BioAgeInput,
  logs: DailyActivity[],
  today: string,
  baseline: ActivityBaseline,
): ActivityProjection | null {
  const summary = summarizeActivity(logs, today, baseline);
  if (!summary) return null;
  const current = calculateBioAge(input);
  return {
    version: ACTIVITY_MODEL_VERSION,
    summary,
    dose: doseOf(summary),
    now: scenario(
      input,
      current,
      summary,
      rampFraction(summary.weeksSinceStart),
    ),
    sustained: scenario(input, current, summary, rampFraction(RAMP_MAX_WEEKS)),
  };
}
