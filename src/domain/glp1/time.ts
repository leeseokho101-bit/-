/**
 * 한국 시간(UTC+9, 서머타임 없음) 계산. 하루 경계·시각 표시는 모두 한국 기준이다.
 * 고정 오프셋이라 서버 시간대와 관계없이 같은 결과가 나온다 (결정성).
 */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** 시각 → 한국 날짜 (YYYY-MM-DD) */
export function kstDate(at: Date | number): string {
  const ms = typeof at === "number" ? at : at.getTime();
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 한국 날짜 + 시각(HH:mm) → Date */
export function kstDateTime(date: string, time = "00:00"): Date {
  return new Date(Date.parse(`${date}T${time}:00+09:00`));
}

/** 한국 날짜의 시작 시각(00:00 KST) */
export function kstDayStart(date: string): number {
  return kstDateTime(date).getTime();
}

/** 시각 → 한국 시:분 (HH:mm) */
export function kstTime(at: Date | number): string {
  const ms = typeof at === "number" ? at : at.getTime();
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(11, 16);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 두 한국 날짜 사이 일수 (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS,
  );
}
