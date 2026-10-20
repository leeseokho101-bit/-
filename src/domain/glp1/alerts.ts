/**
 * 위험 신호(에스컬레이션) 규칙 — 체크인·혈당·투약 기록을 모아 담당 의원 연락 안내를 만든다.
 * 계획서 3-3 "지속 구토, 저혈당 반복 등", 3-4 "저혈당, 심한 부작용, 2회 이상 투약 누락".
 * 기준값은 초안이며 의료 자문이 필요하다 (docs/RULES_REFERENCE.md §7).
 */
import type { LowEvent } from "./cgm";
import type { SymptomScores, TriageLevel } from "./symptoms";
import { addDaysIso, kstDate } from "./time";

export const ALERT_KINDS = [
  "SEVERE_SYMPTOM",
  "PERSISTENT_VOMITING",
  "LOW_GLUCOSE",
  "SEVERE_LOW_GLUCOSE",
  "MISSED_DOSES",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export type AlertSignal = {
  kind: AlertKind;
  level: Exclude<TriageLevel, "NONE" | "SELF_CARE">;
  /** 같은 신호를 여러 번 기록하지 않기 위한 키 (신호가 생긴 한국 날짜) */
  dedupeKey: string;
};

/** 신호를 찾는 기간 (오늘 포함) */
export const ALERT_LOOKBACK_DAYS = 7;
/** 구토가 이 일수 이상 이어지면 "지속 구토" */
export const PERSISTENT_VOMITING_DAYS = 3;
/** 7일 안에 저혈당 구간이 이 횟수 이상이면 "저혈당 반복" */
export const RECURRENT_LOW_COUNT = 2;

export type AlertInput = {
  today: string;
  checkIns: { date: string; triage: TriageLevel; symptoms: SymptomScores }[];
  lowEvents: LowEvent[];
  /** key: 놓침이 이어지는 동안 같은 값 (다음 예정일) — 새로 놓칠 때만 새 신호 */
  missed: { count: number; alert: boolean; key: string };
};

export function evaluateAlerts(input: AlertInput): AlertSignal[] {
  const from = addDaysIso(input.today, -(ALERT_LOOKBACK_DAYS - 1));
  const recent = input.checkIns
    .filter((c) => c.date >= from && c.date <= input.today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: AlertSignal[] = [];

  for (const c of recent) {
    if (c.triage === "URGENT" || c.triage === "CONTACT_CLINIC")
      out.push({ kind: "SEVERE_SYMPTOM", level: c.triage, dedupeKey: c.date });
  }

  // 구토가 연달아 이어진 날 수 (기록 없는 날에서 끊긴다)
  let streak = 0;
  let prev: string | null = null;
  for (const c of recent) {
    const vomited = c.symptoms.VOMITING > 0;
    streak = vomited
      ? prev && addDaysIso(prev, 1) === c.date
        ? streak + 1
        : 1
      : 0;
    prev = vomited ? c.date : null;
    if (streak === PERSISTENT_VOMITING_DAYS)
      out.push({
        kind: "PERSISTENT_VOMITING",
        level: "CONTACT_CLINIC",
        dedupeKey: c.date,
      });
  }

  const lows = input.lowEvents
    .filter((e) => kstDate(e.start) >= from)
    .sort((a, b) => a.start - b.start);
  const severe = lows.filter((e) => e.level === 2);
  if (severe.length)
    out.push({
      kind: "SEVERE_LOW_GLUCOSE",
      level: "CONTACT_CLINIC",
      dedupeKey: kstDate(severe[severe.length - 1].start),
    });
  if (lows.length >= RECURRENT_LOW_COUNT)
    out.push({
      kind: "LOW_GLUCOSE",
      level: "CONTACT_CLINIC",
      // 새 저혈당 구간이 생길 때만 새 신호
      dedupeKey: kstDate(lows[lows.length - 1].start),
    });

  if (input.missed.alert)
    out.push({
      kind: "MISSED_DOSES",
      level: "CONTACT_CLINIC",
      dedupeKey: input.missed.key,
    });
  return out;
}
