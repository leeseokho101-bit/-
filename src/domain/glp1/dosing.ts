/**
 * 투약 일정 규칙 — 다음 투약 예정일, 놓친 횟수, 주사 부위 순환.
 * 놓친 투약을 언제 맞을지는 판단하지 않는다 (담당 의원 문의 안내만).
 */
import type { DrugInfo } from "./drugs";
import { addDaysIso, daysBetween, kstDate } from "./time";

export const INJECTION_SITES = [
  "ABDOMEN_LEFT",
  "ABDOMEN_RIGHT",
  "THIGH_LEFT",
  "THIGH_RIGHT",
  "ARM_LEFT",
  "ARM_RIGHT",
] as const;
export type InjectionSite = (typeof INJECTION_SITES)[number];

export type DoseRecord = {
  takenAt: Date;
  status: "TAKEN" | "MISSED";
  doseMg: number;
  site: InjectionSite | null;
};

/** 놓침 알림 기준 — 최근 28일 안에 놓친 횟수 (초안, 의료 자문 필요) */
export const MISSED_WINDOW_DAYS = 28;
export const MISSED_ALERT_THRESHOLD: Record<1 | 7, number> = {
  // 주 1회: 계획서 기준 "2회 이상 투약 누락"
  7: 2,
  // 매일: 하루 놓침은 흔해 같은 기준이면 알림이 지나치게 잦다 → 4회
  1: 4,
};

export type DoseSchedule = {
  /** 다음 투약 예정일 (한국 날짜) */
  nextDue: string;
  /** 오늘 기준 남은 날 (0 = 오늘, 음수 = 지남) */
  daysUntil: number;
  /** 마지막으로 투약한 날 (없으면 null) */
  lastTaken: string | null;
};

function latest(records: DoseRecord[], status?: DoseRecord["status"]) {
  return records
    .filter((r) => !status || r.status === status)
    .reduce<DoseRecord | null>(
      (a, r) => (!a || r.takenAt > a.takenAt ? r : a),
      null,
    );
}

/**
 * 다음 예정일 = 마지막 기록(투약함·놓침) + 간격. 기록이 없으면 첫 투약일.
 * 놓침으로 기록한 회차는 지나간 것으로 보고 다음 회차로 넘어간다.
 */
export function doseSchedule(
  drug: DrugInfo,
  startDate: string,
  records: DoseRecord[],
  today: string,
): DoseSchedule {
  const last = latest(records);
  const lastTaken = latest(records, "TAKEN");
  const nextDue = last
    ? addDaysIso(kstDate(last.takenAt), drug.intervalDays)
    : startDate;
  return {
    nextDue,
    daysUntil: daysBetween(today, nextDue),
    lastTaken: lastTaken ? kstDate(lastTaken.takenAt) : null,
  };
}

/**
 * 최근 28일 동안 놓친 횟수 = "놓침"으로 기록한 회차 + 기록 없이 지나간 예정일.
 * 기록 없이 지나간 예정일: 마지막 기록 이후 오늘 전날까지 돌아온 예정일 수.
 */
export function missedDoseCount(
  drug: DrugInfo,
  startDate: string,
  records: DoseRecord[],
  today: string,
): number {
  const from = addDaysIso(today, -(MISSED_WINDOW_DAYS - 1));
  const recorded = records.filter(
    (r) => r.status === "MISSED" && kstDate(r.takenAt) >= from,
  ).length;
  let due = doseSchedule(drug, startDate, records, today).nextDue;
  let implicit = 0;
  while (due < today) {
    if (due >= from) implicit++;
    due = addDaysIso(due, drug.intervalDays);
  }
  return recorded + implicit;
}

export function isMissedAlert(drug: DrugInfo, missed: number): boolean {
  return missed >= MISSED_ALERT_THRESHOLD[drug.intervalDays];
}

/**
 * 다음 주사 부위 제안 — 같은 부위를 연달아 쓰지 않도록 가장 오래 쉰 부위.
 * 한 번도 쓰지 않은 부위가 먼저이고, 같으면 목록 순서 (결정성).
 */
export function suggestNextSite(records: DoseRecord[]): InjectionSite {
  const lastUsed = new Map<InjectionSite, number>();
  for (const r of records) {
    if (r.status !== "TAKEN" || !r.site) continue;
    const t = r.takenAt.getTime();
    if ((lastUsed.get(r.site) ?? -Infinity) < t) lastUsed.set(r.site, t);
  }
  let best: InjectionSite = INJECTION_SITES[0];
  let bestT = Infinity;
  for (const site of INJECTION_SITES) {
    const t = lastUsed.get(site) ?? -Infinity;
    if (t < bestT) {
      best = site;
      bestT = t;
    }
  }
  return best;
}

/** 현재 용량을 시작한 지 며칠째인지 (0 = 시작일). 증량 직후 안내에 쓴다 */
export const ESCALATION_SUPPORT_DAYS = 14;

export function daysOnCurrentDose(doseSince: string, today: string): number {
  return daysBetween(doseSince, today);
}
