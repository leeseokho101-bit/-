/**
 * 약물 반응 타임라인 — 투약 시점·용량에 맞춰 식욕·속 불편감·혈당·식후 반응을 나란히 정렬한다.
 * (계획서 5-2 "약물 반응 곡선 · 증량 반응 비교", 1~2단계: 시계열 정렬과 투약일 기준 집계)
 *
 * 평균을 보여줄 뿐 약효를 판정하거나 용량을 제안하지 않는다.
 */
import {
  glucoseStats,
  pointsBetween,
  type GlucosePoint,
  type GlucoseStats,
} from "./cgm";
import type { DoseRecord } from "./dosing";
import type { SymptomScores } from "./symptoms";
import { addDaysIso, daysBetween, kstDate, kstDayStart } from "./time";

export type DayInputs = {
  checkIns: {
    date: string;
    appetite: number | null;
    symptoms: SymptomScores;
    weightKg: number | null;
  }[];
  glucose: GlucosePoint[];
  /** 식사별 식후 상승폭 (반응을 계산할 수 있는 식사만) */
  mealRises: { at: number; rise: number }[];
};

type Avg = { avg: number; n: number } | null;

function average(values: number[], digits = 1): Avg {
  if (!values.length) return null;
  const f = 10 ** digits;
  return {
    avg:
      Math.round((values.reduce((a, b) => a + b, 0) / values.length) * f) / f,
    n: values.length,
  };
}

/** 하루 평균 혈당 (15분 간격 기준 6시간 이상 측정된 날만) */
function dailyMeans(points: GlucosePoint[]): Map<string, number> {
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    const d = kstDate(p.t);
    byDay.set(d, [...(byDay.get(d) ?? []), p.mgdl]);
  }
  const out = new Map<string, number>();
  for (const [d, v] of byDay)
    if (v.length >= 24)
      out.set(d, Math.round(v.reduce((a, b) => a + b, 0) / v.length));
  return out;
}

export type DoseDayRow = {
  /** 투약 후 경과일 (0 = 투약한 날) */
  offset: number;
  appetite: Avg;
  nausea: Avg;
  meanGlucose: Avg;
  mealRise: Avg;
};

/** 최근 몇 번의 투약을 모을지 */
export const PROFILE_DOSES = 4;

/**
 * 주 1회 약: 투약 후 0~6일째 날마다 평균. 최근 4번의 투약 주기를 모은다.
 * "투약 직후 식욕이 가장 낮고 주 후반에 돌아오는지"처럼 개인별 패턴을 보여준다.
 */
export function doseDayProfile(
  doses: DoseRecord[],
  inputs: DayInputs,
  today: string,
  intervalDays = 7,
): DoseDayRow[] {
  const taken = doses
    .filter((d) => d.status === "TAKEN")
    .map((d) => kstDate(d.takenAt))
    .sort()
    .slice(-PROFILE_DOSES);
  const means = dailyMeans(inputs.glucose);
  const rows: DoseDayRow[] = [];
  for (let offset = 0; offset < intervalDays; offset++) {
    const days = taken
      .map((d, i) => ({ day: addDaysIso(d, offset), next: taken[i + 1] }))
      // 다음 투약일 이후 날은 다음 주기에 속한다
      .filter(({ day, next }) => day <= today && (!next || day < next))
      .map(({ day }) => day);
    const set = new Set(days);
    const checks = inputs.checkIns.filter((c) => set.has(c.date));
    rows.push({
      offset,
      appetite: average(
        checks.flatMap((c) => (c.appetite === null ? [] : [c.appetite])),
      ),
      nausea: average(checks.map((c) => c.symptoms.NAUSEA)),
      meanGlucose: average(
        days.flatMap((d) => (means.has(d) ? [means.get(d)!] : [])),
        0,
      ),
      mealRise: average(
        inputs.mealRises
          .filter((m) => set.has(kstDate(m.at)))
          .map((m) => m.rise),
        0,
      ),
    });
  }
  return rows;
}

export type DosePeriod = {
  /** null = 투약 시작 전 */
  doseMg: number | null;
  from: string;
  /** 포함 */
  to: string;
  days: number;
  glucose: GlucoseStats | null;
  appetite: Avg;
  nausea: Avg;
  mealRise: Avg;
  /** 기간 안 첫 기록 대비 마지막 기록 체중 변화 (kg) */
  weightChange: number | null;
};

/** 투약 시작 전 비교 구간으로 쓰는 최대 일수 */
export const BEFORE_START_DAYS = 14;

/**
 * 용량별 비교: 투약 기록의 용량이 바뀐 날마다 구간을 나눈다.
 * 투약 시작 전 혈당 기록이 있으면 "시작 전" 구간(최대 14일)을 맨 앞에 둔다.
 */
export function dosePeriods(
  doses: DoseRecord[],
  inputs: DayInputs,
  startDate: string,
  today: string,
): DosePeriod[] {
  const taken = doses
    .filter((d) => d.status === "TAKEN")
    .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  const segments: { doseMg: number | null; from: string; to: string }[] = [];
  const firstDay = taken.length ? kstDate(taken[0].takenAt) : startDate;
  const beforeFrom = addDaysIso(firstDay, -BEFORE_START_DAYS);
  if (
    inputs.glucose.some(
      (p) => kstDate(p.t) >= beforeFrom && kstDate(p.t) < firstDay,
    )
  )
    segments.push({
      doseMg: null,
      from: beforeFrom,
      to: addDaysIso(firstDay, -1),
    });
  for (const d of taken) {
    const day = kstDate(d.takenAt);
    const last = segments[segments.length - 1];
    if (last && last.doseMg === d.doseMg) continue;
    if (last && last.doseMg !== null) last.to = addDaysIso(day, -1);
    segments.push({ doseMg: d.doseMg, from: day, to: today });
  }
  return segments
    .filter((s) => s.to >= s.from)
    .map((s) => {
      const inRange = (date: string) => date >= s.from && date <= s.to;
      const checks = inputs.checkIns
        .filter((c) => inRange(c.date))
        .sort((a, b) => a.date.localeCompare(b.date));
      const weights = checks.flatMap((c) =>
        c.weightKg === null ? [] : [c.weightKg],
      );
      const from = kstDayStart(s.from);
      const to = kstDayStart(addDaysIso(s.to, 1));
      const days = daysBetween(s.from, s.to) + 1;
      return {
        ...s,
        days,
        glucose: glucoseStats(
          pointsBetween(inputs.glucose, from, to),
          to - from,
        ),
        appetite: average(
          checks.flatMap((c) => (c.appetite === null ? [] : [c.appetite])),
        ),
        nausea: average(checks.map((c) => c.symptoms.NAUSEA)),
        mealRise: average(
          inputs.mealRises
            .filter((m) => m.at >= from && m.at < to)
            .map((m) => m.rise),
          0,
        ),
        weightChange:
          weights.length >= 2
            ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10
            : null,
      };
    });
}
