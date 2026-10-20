import type { Count, CurvePoint } from "@/domain/pharma/stats";

export const countText = (c: Count) =>
  c === null ? "5 미만" : c.toLocaleString();

/** 월별 신규 등록 막대 (단일 계열). 가려진 달은 막대 대신 "5 미만" 글자 */
export function MonthlyBars({
  data,
}: {
  data: { month: string; count: Count }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count ?? 0));
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted text-sm">
        월별 신규 등록 환자 (동의자)
      </figcaption>
      <div className="flex h-32 items-end gap-2" role="list">
        {data.map((d) => (
          <div
            key={d.month}
            role="listitem"
            aria-label={`${d.month} ${countText(d.count)}명`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-xs font-semibold">{countText(d.count)}</span>
            {d.count !== null ? (
              <div
                className="bg-chart-1 w-full max-w-6 rounded-t"
                style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              />
            ) : (
              <div className="bg-border h-0.5 w-3" />
            )}
          </div>
        ))}
      </div>
      <div aria-hidden className="border-muted/40 flex gap-2 border-t pt-1">
        {data.map((d) => (
          <span key={d.month} className="text-muted flex-1 text-center text-xs">
            {Number(d.month.slice(5))}월
          </span>
        ))}
      </div>
    </figure>
  );
}

const W = 360;
const H = 180;
const PAD = { left: 34, right: 10, top: 10, bottom: 22 };

/** 지속 복용 곡선 (계단형, 단일 계열) + 표 */
export function PersistenceChart({ curve }: { curve: CurvePoint[] }) {
  const x = (w: number) => PAD.left + (w / 12) * (W - PAD.left - PAD.right);
  const y = (p: number) => PAD.top + (1 - p / 100) * (H - PAD.top - PAD.bottom);
  let d = `M${x(0)},${y(100)}`;
  for (const p of curve.slice(1)) d += ` H${x(p.week)} V${y(p.persisting)}`;
  const last = curve[curve.length - 1];
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-muted">투약 시작 후 주차별 지속 복용 비율</span>
        <span className="font-semibold">
          {last.week}주 {last.persisting}%
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="지속 복용 곡선. 아래 표에 주차별 값이 있어요."
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeDasharray={v === 50 ? "3 3" : undefined}
            />
            <text
              x={PAD.left - 4}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted text-[9px]"
            >
              {v}%
            </text>
          </g>
        ))}
        {[0, 4, 8, 12].map((w) => (
          <text
            key={w}
            x={x(w)}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted text-[9px]"
          >
            {w}주
          </text>
        ))}
        <path
          d={d}
          fill="none"
          className="stroke-chart-1"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <circle
          cx={x(last.week)}
          cy={y(last.persisting)}
          r={4}
          className="fill-chart-1 stroke-surface"
          strokeWidth={2}
        />
      </svg>
      <details className="text-sm">
        <summary className="text-primary cursor-pointer font-semibold">
          표로 보기
        </summary>
        <table className="mt-2 w-full text-right">
          <thead className="text-muted">
            <tr>
              <th className="text-left font-medium">주차</th>
              <th className="font-medium">지속 복용</th>
              <th className="font-medium">분석 대상</th>
            </tr>
          </thead>
          <tbody>
            {curve.map((p) => (
              <tr key={p.week} className="border-border border-t">
                <td className="text-left">{p.week}주</td>
                <td>{p.persisting}%</td>
                <td>{p.atRisk}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
