/**
 * 의사 대시보드용 요약 — 복용률, AGP(시간대별 혈당 분포), 증상·체중 요약, 환자 상태 표시.
 * 계획서 3-4: "순응도·이상 신호 색상 표시", "내원 전 1장 리포트 (체중·혈당(AGP)·부작용·복용률),
 * 증량 판단에 참고할 지표". 판단(증량 권고 등)은 하지 않고 사실만 모은다.
 */
import type { AlertKind } from "./alerts";
import type { GlucosePoint } from "./cgm";
import type { DoseRecord } from "./dosing";
import type { DrugInfo } from "./drugs";
import {
  SYMPTOMS,
  type SymptomCode,
  type SymptomScores,
  type TriageLevel,
} from "./symptoms";
import {
  addDaysIso,
  daysBetween,
  kstDate,
  KST_OFFSET_MS,
  HOUR_MS,
} from "./time";

// ─── 복용률 ───

export type Adherence = {
  /** 기간 안 예정 횟수 */
  expected: number;
  /** 투약함으로 기록한 횟수 (예정 횟수를 넘으면 예정 횟수로 자른다) */
  taken: number;
  /** 놓침으로 기록한 횟수 */
  missedRecorded: number;
  /** 0~1, 예정 횟수가 0이면 null */
  rate: number | null;
};

/**
 * 기간 [from, to] (한국 날짜) 복용률 = 투약 기록 수 / 예정 횟수.
 * 예정일은 첫 투약일부터 투약 간격마다로 센다 (하루 이틀 늦게 맞아도 그 회차로 본다).
 * 오늘이 예정일인데 아직 기록이 없으면 그 회차는 세지 않는다.
 */
export function adherence(
  drug: DrugInfo,
  startDate: string,
  doses: DoseRecord[],
  from: string,
  to: string,
): Adherence {
  const first = from > startDate ? from : startDate;
  let expected = 0;
  if (first <= to) {
    const offset = daysBetween(startDate, first);
    let due = addDaysIso(
      startDate,
      Math.ceil(offset / drug.intervalDays) * drug.intervalDays,
    );
    for (; due <= to; due = addDaysIso(due, drug.intervalDays)) expected++;
  }
  const inRange = doses.filter((d) => {
    const day = kstDate(d.takenAt);
    return day >= first && day <= to;
  });
  const takenRaw = inRange.filter((d) => d.status === "TAKEN").length;
  // 오늘 예정분이 아직 기록 전이면 분모에서 뺀다
  const todayPending =
    expected > 0 &&
    daysBetween(startDate, to) % drug.intervalDays === 0 &&
    !inRange.some((d) => kstDate(d.takenAt) === to);
  const exp = expected - (todayPending ? 1 : 0);
  const taken = Math.min(takenRaw, exp);
  return {
    expected: exp,
    taken,
    missedRecorded: inRange.filter((d) => d.status === "MISSED").length,
    rate: exp > 0 ? taken / exp : null,
  };
}

// ─── AGP ───

export type AgpHour = {
  hour: number;
  n: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
};

/** 시간대마다 최소 측정 수 — 적으면 분위수를 그리지 않는다 */
export const AGP_MIN_PER_HOUR = 4;

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

/**
 * 여러 날의 측정값을 하루 24시간(한국 시간)에 겹쳐 시간대별 5·25·50·75·95 백분위.
 * (Ambulatory Glucose Profile — 국제 합의의 표준 보고 형식)
 */
export function agpProfile(points: GlucosePoint[]): (AgpHour | null)[] {
  const byHour: number[][] = Array.from({ length: 24 }, () => []);
  for (const p of points) {
    const h = Math.floor(((p.t + KST_OFFSET_MS) % (24 * HOUR_MS)) / HOUR_MS);
    byHour[h].push(p.mgdl);
  }
  return byHour.map((v, hour) => {
    if (v.length < AGP_MIN_PER_HOUR) return null;
    const s = [...v].sort((a, b) => a - b);
    return {
      hour,
      n: s.length,
      p5: quantile(s, 0.05),
      p25: quantile(s, 0.25),
      p50: quantile(s, 0.5),
      p75: quantile(s, 0.75),
      p95: quantile(s, 0.95),
    };
  });
}

// ─── 증상·체중 ───

export type CheckInLite = {
  date: string;
  symptoms: SymptomScores;
  appetite: number | null;
  weightKg: number | null;
  triage: TriageLevel;
};

export type SymptomSummary = {
  checkInDays: number;
  periodDays: number;
  bySymptom: Record<
    SymptomCode,
    { days: number; moderateDays: number; max: number }
  >;
  /** 위장관 증상(메스꺼움·구토·설사·복통) 중 하나라도 "보통" 이상인 날 */
  giModerateDays: number;
  avgAppetite: number | null;
  /** 의원 상담·바로 진료 안내가 나온 날 */
  escalatedDays: number;
};

const GI: SymptomCode[] = ["NAUSEA", "VOMITING", "DIARRHEA", "ABDOMINAL_PAIN"];

export function symptomSummary(
  checkIns: CheckInLite[],
  from: string,
  to: string,
): SymptomSummary {
  const list = checkIns.filter((c) => c.date >= from && c.date <= to);
  const bySymptom = Object.fromEntries(
    SYMPTOMS.map((s) => [
      s,
      {
        days: list.filter((c) => c.symptoms[s] > 0).length,
        moderateDays: list.filter((c) => c.symptoms[s] >= 2).length,
        max: Math.max(0, ...list.map((c) => c.symptoms[s])),
      },
    ]),
  ) as SymptomSummary["bySymptom"];
  const appetites = list.flatMap((c) =>
    c.appetite === null ? [] : [c.appetite],
  );
  return {
    checkInDays: list.length,
    periodDays: daysBetween(from, to) + 1,
    bySymptom,
    giModerateDays: list.filter((c) => GI.some((s) => c.symptoms[s] >= 2))
      .length,
    avgAppetite: appetites.length
      ? Math.round(
          (appetites.reduce((a, b) => a + b, 0) / appetites.length) * 10,
        ) / 10
      : null,
    escalatedDays: list.filter(
      (c) => c.triage === "CONTACT_CLINIC" || c.triage === "URGENT",
    ).length,
  };
}

export type WeightTrend = {
  first: { date: string; kg: number };
  last: { date: string; kg: number };
  change: number;
  /** % (음수 = 감소) */
  changePct: number;
  points: { date: string; kg: number }[];
};

export function weightTrend(
  checkIns: CheckInLite[],
  from: string,
  to: string,
): WeightTrend | null {
  const points = checkIns
    .filter((c) => c.date >= from && c.date <= to && c.weightKg !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => ({ date: c.date, kg: c.weightKg! }));
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const change = Math.round((last.kg - first.kg) * 10) / 10;
  return {
    first,
    last,
    change,
    changePct: Math.round((change / first.kg) * 1000) / 10,
    points,
  };
}

// ─── 환자 목록 상태 표시 ───

export const PATIENT_FLAGS = ["ALERT", "WATCH", "OK"] as const;
export type PatientFlag = (typeof PATIENT_FLAGS)[number];

export type FlagReason =
  | { kind: "alert"; alert: AlertKind }
  | { kind: "low-adherence"; rate: number }
  | { kind: "no-check-in"; days: number | null };

/** 복용률이 이 값 미만이면 "관찰" (초안) */
export const LOW_ADHERENCE = 0.8;
/** 체크인이 이 일수 넘게 없으면 "관찰" */
export const CHECK_IN_GAP_DAYS = 7;

/**
 * 환자 목록 표시: ALERT(확인하지 않은 위험 신호) > WATCH(복용률 낮음·체크인 끊김) > OK.
 * 색과 함께 아이콘·글자로도 표시한다.
 */
export function patientFlag(input: {
  today: string;
  openAlerts: AlertKind[];
  adherenceRate: number | null;
  lastCheckIn: string | null;
  enrolledOn: string;
}): { flag: PatientFlag; reasons: FlagReason[] } {
  const reasons: FlagReason[] = input.openAlerts.map((a) => ({
    kind: "alert",
    alert: a,
  }));
  if (input.adherenceRate !== null && input.adherenceRate < LOW_ADHERENCE)
    reasons.push({ kind: "low-adherence", rate: input.adherenceRate });
  const gap = input.lastCheckIn
    ? daysBetween(input.lastCheckIn, input.today)
    : null;
  if (
    (gap !== null && gap > CHECK_IN_GAP_DAYS) ||
    (gap === null &&
      daysBetween(input.enrolledOn, input.today) > CHECK_IN_GAP_DAYS)
  )
    reasons.push({ kind: "no-check-in", days: gap });
  const flag: PatientFlag = input.openAlerts.length
    ? "ALERT"
    : reasons.length
      ? "WATCH"
      : "OK";
  return { flag, reasons };
}

/** 리포트 기간: 지난 내원일(오늘 제외) 이후, 없으면 첫 투약일부터. 최대 90일 */
export const REPORT_MAX_DAYS = 90;

export function reportPeriod(
  today: string,
  startDate: string,
  visits: string[],
): { from: string; to: string; sinceVisit: string | null } {
  const last =
    visits
      .filter((v) => v < today)
      .sort()
      .pop() ?? null;
  const base = last ?? startDate;
  const earliest = addDaysIso(today, -(REPORT_MAX_DAYS - 1));
  const from = base < earliest ? earliest : base > today ? today : base;
  return { from, to: today, sinceVisit: last };
}
