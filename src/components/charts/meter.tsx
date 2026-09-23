/** 한 개의 비율을 보여주는 미터 (값은 항상 글자로 함께 표시) */
export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-lg font-bold">{pct}%</span>
      </div>
      <div
        className="bg-chart-track h-3 w-full overflow-hidden rounded-full"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${label} ${pct}%`}
      >
        <div
          className="bg-chart-1 h-full rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
