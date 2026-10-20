import { kstDate, kstTime } from "@/domain/glp1/time";

/** "10/20 (화)" */
export function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${"일월화수목금토"[d.getUTCDay()]})`;
}

/** "10/20 (화) 08:30" */
export function formatDateTime(at: Date | number): string {
  return `${formatDay(kstDate(at))} ${kstTime(at)}`;
}

/** 다음 투약까지 남은 날 */
export function dueText(daysUntil: number): string {
  if (daysUntil === 0) return "오늘이 투약일이에요";
  if (daysUntil === 1) return "내일이 투약일이에요";
  if (daysUntil > 1) return `${daysUntil}일 뒤 투약일이에요`;
  return `투약 예정일이 ${-daysUntil}일 지났어요`;
}
