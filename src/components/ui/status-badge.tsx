import { statusContent } from "@/content/domains";
import type { DomainStatus, ManagementLevel } from "@/domain/analysis/types";

/** ●●●○○ — 관리 필요도. 스크린리더에는 "5단계 중 3단계"로 읽힌다 */
export function LevelDots({
  level,
}: {
  level: ManagementLevel | number | null;
}) {
  if (level === null) {
    return (
      <span className="text-muted tracking-widest" aria-label="판단 보류">
        - - - - -
      </span>
    );
  }
  return (
    <span
      className="tracking-widest"
      aria-label={`관리 필요도 5단계 중 ${level}단계`}
    >
      <span aria-hidden>{"●".repeat(level)}</span>
      <span aria-hidden className="text-border">
        {"●".repeat(5 - level)}
      </span>
    </span>
  );
}

export function StatusBadge({ status }: { status: DomainStatus }) {
  const s = statusContent[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${s.tone}`}
    >
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
