import { BandBadge } from "@/components/ui/band-badge";
import type { KeyMetric } from "@/features/analysis/key-metrics";

export function KeyMetricsTable({ metrics }: { metrics: KeyMetric[] }) {
  if (metrics.length === 0) {
    return <p className="text-muted text-sm">입력된 건강검진 수치가 없어요.</p>;
  }
  return (
    <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
      {metrics.map((m) => (
        <li
          key={m.item}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div>
            <p className="font-semibold">{m.label}</p>
            <p className="text-muted text-xs">참고 {m.guide}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-bold">{m.value}</span>
            <BandBadge band={m.band} />
          </div>
        </li>
      ))}
    </ul>
  );
}
