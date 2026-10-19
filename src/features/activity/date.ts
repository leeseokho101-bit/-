/** 한국 날짜 (YYYY-MM-DD) — 서버 시간대와 관계없이 하루 경계를 한국 기준으로 맞춘다 */
export function koreaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 지난 날짜도 고쳐 쓸 수 있는 기간 (오늘 포함) */
export const EDITABLE_DAYS = 7;
