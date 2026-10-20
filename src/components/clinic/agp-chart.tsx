import { GLUCOSE_RANGES } from "@/domain/glp1/cgm";
import type { AgpHour } from "@/domain/glp1/clinic";

const W = 360;
const H = 170;
const PAD = { left: 30, right: 8, top: 8, bottom: 20 };
const Y_MIN = 40;
const Y_MAX = 350;

/**
 * AGP (최근 14일을 하루로 겹친 시간대별 분포). 5–95 백분위 띠, 25–75 백분위 띠, 중앙값 선.
 * 같은 색상의 밝기 단계라 순서가 분명하고, 범례와 표를 함께 둔다.
 */
export function AgpChart({ hours }: { hours: (AgpHour | null)[] }) {
  const x = (h: number) => PAD.left + (h / 24) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top +
    (1 - (Math.min(Y_MAX, Math.max(Y_MIN, v)) - Y_MIN) / (Y_MAX - Y_MIN)) *
      (H - PAD.top - PAD.bottom);
  // 측정이 부족한 시간대에서 띠를 끊는다
  const runs: AgpHour[][] = [];
  for (const h of hours) {
    if (!h) runs.push([]);
    else (runs[runs.length - 1] ?? runs[runs.push([]) - 1]).push(h);
  }
  const band = (run: AgpHour[], lo: keyof AgpHour, hi: keyof AgpHour) =>
    run
      .map((h, i) => `${i ? "L" : "M"}${x(h.hour + 0.5)},${y(h[hi])}`)
      .join(" ") +
    " " +
    [...run]
      .reverse()
      .map((h) => `L${x(h.hour + 0.5)},${y(h[lo])}`)
      .join(" ") +
    " Z";
  const line = (run: AgpHour[]) =>
    run
      .map((h, i) => `${i ? "L" : "M"}${x(h.hour + 0.5)},${y(h.p50)}`)
      .join(" ");
  const usable = runs.filter((r) => r.length >= 2);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="AGP 그래프. 아래 표에 3시간 단위 값이 있어요."
      >
        {[GLUCOSE_RANGES.low, GLUCOSE_RANGES.high, 250].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-muted"
              strokeWidth={v === 250 ? 0.5 : 1}
              strokeDasharray={v === 250 ? "3 3" : undefined}
            />
            <text
              x={PAD.left - 4}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted text-[9px]"
            >
              {v}
            </text>
          </g>
        ))}
        {usable.map((r, i) => (
          <path
            key={`o${i}`}
            d={band(r, "p5", "p95")}
            className="fill-agp-outer"
          />
        ))}
        {usable.map((r, i) => (
          <path
            key={`i${i}`}
            d={band(r, "p25", "p75")}
            className="fill-agp-inner"
          />
        ))}
        {usable.map((r, i) => (
          <path
            key={`m${i}`}
            d={line(r)}
            fill="none"
            className="stroke-chart-1"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {[0, 6, 12, 18, 24].map((h) => (
          <text
            key={h}
            x={x(h)}
            y={H - 5}
            textAnchor="middle"
            className="fill-muted text-[9px]"
          >
            {h}시
          </text>
        ))}
      </svg>
      <figcaption className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <span aria-hidden className="bg-chart-1 inline-block h-0.5 w-4" />{" "}
          중앙값
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="bg-agp-inner inline-block size-3 rounded-sm"
          />{" "}
          25–75 백분위
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="bg-agp-outer inline-block size-3 rounded-sm"
          />{" "}
          5–95 백분위
        </span>
        <span>실선 70·180 mg/dL</span>
      </figcaption>
      <details className="text-xs print:hidden">
        <summary className="text-primary cursor-pointer font-semibold">
          표로 보기
        </summary>
        <table className="mt-1 w-full text-right">
          <thead>
            <tr className="text-muted">
              <th className="text-left font-medium">시각</th>
              <th className="font-medium">5%</th>
              <th className="font-medium">25%</th>
              <th className="font-medium">중앙값</th>
              <th className="font-medium">75%</th>
              <th className="font-medium">95%</th>
            </tr>
          </thead>
          <tbody>
            {hours
              .filter((h, i): h is AgpHour => !!h && i % 3 === 0)
              .map((h) => (
                <tr key={h.hour} className="border-border border-t">
                  <td className="text-left">{h.hour}시</td>
                  <td>{h.p5}</td>
                  <td>{h.p25}</td>
                  <td className="font-semibold">{h.p50}</td>
                  <td>{h.p75}</td>
                  <td>{h.p95}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
