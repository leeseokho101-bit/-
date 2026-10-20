/**
 * 연속혈당(CGM) 지표 — 목표 범위 내 시간(TIR), 평균·변동성, 저혈당 구간, 식후 반응.
 *
 * 기준: International Consensus on Time in Range (Battelino T, et al. Diabetes Care 2019;42:1593)
 * - 범위: 매우 낮음 <54, 낮음 54–69, 목표 70–180, 높음 181–250, 매우 높음 >250 mg/dL
 * - 저혈당 구간(event): 기준 미만이 15분 이상 이어질 때
 * - 지표 신뢰: 최근 14일, 측정 시간 70% 이상 권장
 * - GMI(%) = 3.31 + 0.02392 × 평균(mg/dL) (Bergenstal RM, et al. Diabetes Care 2018;41:2275)
 * 위 목표값은 당뇨 관리용 합의 기준이다. 화면에는 "참고 목표"로만 쓰고 판정(진단)하지 않는다.
 */
import { HOUR_MS, MINUTE_MS } from "./time";

export type GlucosePoint = { t: number; mgdl: number };

export const GLUCOSE_RANGES = {
  veryLow: 54,
  low: 70,
  high: 180,
  veryHigh: 250,
} as const;

/** 합의 권고 목표 (당뇨 관리 기준) */
export const TIR_TARGETS = {
  inRangeMin: 70,
  lowMax: 4,
  veryLowMax: 1,
  highMax: 25,
  veryHighMax: 5,
  cvMax: 36,
  coverageMin: 70,
} as const;

export const RANGE_BANDS = [
  "VERY_LOW",
  "LOW",
  "IN_RANGE",
  "HIGH",
  "VERY_HIGH",
] as const;
export type RangeBand = (typeof RANGE_BANDS)[number];

export function rangeBand(mgdl: number): RangeBand {
  if (mgdl < GLUCOSE_RANGES.veryLow) return "VERY_LOW";
  if (mgdl < GLUCOSE_RANGES.low) return "LOW";
  if (mgdl <= GLUCOSE_RANGES.high) return "IN_RANGE";
  if (mgdl <= GLUCOSE_RANGES.veryHigh) return "HIGH";
  return "VERY_HIGH";
}

/** 이 간격보다 멀리 떨어진 두 측정값은 이어진 것으로 보지 않는다 */
export const MAX_GAP_MS = 20 * MINUTE_MS;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 측정 간격 (중앙값, ms). 측정값이 2개 미만이면 null */
export function samplingInterval(points: GlucosePoint[]): number | null {
  if (points.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const g = points[i].t - points[i - 1].t;
    if (g > 0 && g <= MAX_GAP_MS) gaps.push(g);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

export type GlucoseStats = {
  count: number;
  /** 기간 대비 측정된 시간 비율 (%) */
  coveragePct: number;
  mean: number;
  /** 변동계수 (%) */
  cv: number;
  gmi: number;
  /** 범위별 시간 비율 (%) — 측정값 개수 기준, 합 100 */
  pct: Record<RangeBand, number>;
};

/** 정렬된 측정값 → 기간 지표. 측정값이 없으면 null */
export function glucoseStats(
  points: GlucosePoint[],
  periodMs: number,
): GlucoseStats | null {
  const n = points.length;
  if (!n) return null;
  const sum = points.reduce((a, p) => a + p.mgdl, 0);
  const mean = sum / n;
  const variance =
    n > 1 ? points.reduce((a, p) => a + (p.mgdl - mean) ** 2, 0) / (n - 1) : 0;
  const counts: Record<RangeBand, number> = {
    VERY_LOW: 0,
    LOW: 0,
    IN_RANGE: 0,
    HIGH: 0,
    VERY_HIGH: 0,
  };
  for (const p of points) counts[rangeBand(p.mgdl)]++;
  const pct = Object.fromEntries(
    RANGE_BANDS.map((b) => [b, round1((counts[b] / n) * 100)]),
  ) as Record<RangeBand, number>;
  const interval = samplingInterval(points) ?? 15 * MINUTE_MS;
  return {
    count: n,
    coveragePct: Math.min(100, Math.round(((n * interval) / periodMs) * 100)),
    mean: Math.round(mean),
    cv: round1((Math.sqrt(variance) / mean) * 100),
    gmi: round1(3.31 + 0.02392 * mean),
    pct,
  };
}

export type LowEvent = {
  start: number;
  end: number;
  minMgdl: number;
  /** 1 = 70 미만, 2 = 54 미만이 15분 이상 */
  level: 1 | 2;
};

export const LOW_EVENT_MIN_MS = 15 * MINUTE_MS;

/**
 * 저혈당 구간: 70 미만이 15분 이상 이어진 구간. 그 안에서 54 미만이 15분 이상이면 2단계.
 * 측정이 20분 넘게 끊기면 구간을 나눈다.
 */
export function lowEvents(points: GlucosePoint[]): LowEvent[] {
  const events: LowEvent[] = [];
  let run: GlucosePoint[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const dur = run[run.length - 1].t - run[0].t;
      if (dur >= LOW_EVENT_MIN_MS) {
        events.push({
          start: run[0].t,
          end: run[run.length - 1].t,
          minMgdl: Math.min(...run.map((p) => p.mgdl)),
          level:
            longestBelow(run, GLUCOSE_RANGES.veryLow) >= LOW_EVENT_MIN_MS
              ? 2
              : 1,
        });
      }
    }
    run = [];
  };
  for (const p of points) {
    const prev = run[run.length - 1];
    if (prev && p.t - prev.t > MAX_GAP_MS) flush();
    if (p.mgdl < GLUCOSE_RANGES.low) run.push(p);
    else flush();
  }
  flush();
  return events;
}

function longestBelow(run: GlucosePoint[], limit: number): number {
  let best = 0;
  let start: number | null = null;
  let last = 0;
  for (const p of run) {
    if (p.mgdl < limit) {
      if (start === null) start = p.t;
      last = p.t;
      best = Math.max(best, last - start);
    } else start = null;
  }
  return best;
}

// ─── 식후 반응 ───

/** 식사 전 기준값: 식사 30분 전 ~ 5분 후 중 식사 시각에 가장 가까운 값 */
export const MEAL_BASELINE_BEFORE_MS = 30 * MINUTE_MS;
export const MEAL_BASELINE_AFTER_MS = 5 * MINUTE_MS;
/** 식후 최고값을 찾는 구간 */
export const MEAL_PEAK_WINDOW_MS = 3 * HOUR_MS;
/** 회복: 최고값 이후 기준값 + 20 이하로 돌아온 첫 시각 */
export const MEAL_RECOVERY_MARGIN = 20;

/** 식후 상승폭 구분 (mg/dL, 초안 — 의료 자문 필요) */
export const MEAL_RISE_BANDS = { small: 30, large: 60 } as const;
export type MealRiseBand = "SMALL" | "MODERATE" | "LARGE";

export type MealResponse = {
  baseline: number;
  peak: number;
  rise: number;
  minutesToPeak: number;
  /** 3시간 안에 돌아오지 않았으면 null */
  minutesToRecover: number | null;
  band: MealRiseBand;
};

export function mealRiseBand(rise: number): MealRiseBand {
  if (rise < MEAL_RISE_BANDS.small) return "SMALL";
  if (rise < MEAL_RISE_BANDS.large) return "MODERATE";
  return "LARGE";
}

/** 식사 시각 기준 식후 반응. 측정값이 부족하면 null */
export function mealResponse(
  points: GlucosePoint[],
  mealAt: number,
): MealResponse | null {
  let baseline: GlucosePoint | null = null;
  for (const p of points) {
    if (p.t < mealAt - MEAL_BASELINE_BEFORE_MS) continue;
    if (p.t > mealAt + MEAL_BASELINE_AFTER_MS) break;
    if (!baseline || Math.abs(p.t - mealAt) < Math.abs(baseline.t - mealAt))
      baseline = p;
  }
  if (!baseline) return null;
  const after = points.filter(
    (p) => p.t > baseline.t && p.t <= mealAt + MEAL_PEAK_WINDOW_MS,
  );
  // 식후 3시간 중 1시간 이상은 측정되어야 한다
  if (after.length < 2 || after[after.length - 1].t - baseline.t < HOUR_MS)
    return null;
  const peak = after.reduce((a, p) => (p.mgdl > a.mgdl ? p : a), baseline);
  const recovered = after.find(
    (p) => p.t > peak.t && p.mgdl <= baseline.mgdl + MEAL_RECOVERY_MARGIN,
  );
  const rise = Math.max(0, peak.mgdl - baseline.mgdl);
  return {
    baseline: baseline.mgdl,
    peak: peak.mgdl,
    rise,
    minutesToPeak: Math.round((peak.t - mealAt) / MINUTE_MS),
    minutesToRecover:
      peak === baseline
        ? 0
        : recovered
          ? Math.round((recovered.t - mealAt) / MINUTE_MS)
          : null,
    band: mealRiseBand(rise),
  };
}

/** 구간 [from, to) 의 측정값 (points는 시간순 정렬) */
export function pointsBetween(
  points: GlucosePoint[],
  from: number,
  to: number,
): GlucosePoint[] {
  return points.filter((p) => p.t >= from && p.t < to);
}
