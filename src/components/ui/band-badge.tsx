import { bandContent } from "@/content/bands";
import type { Band } from "@/domain/analysis/types";

export function BandBadge({ band }: { band: Band }) {
  const b = bandContent[band];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${b.tone}`}
    >
      <span aria-hidden>{b.icon}</span>
      {b.label}
    </span>
  );
}
