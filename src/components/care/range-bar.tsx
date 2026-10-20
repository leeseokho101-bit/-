import { rangeLabels } from "@/content/care";
import { RANGE_BANDS, type RangeBand } from "@/domain/glp1/cgm";

export const rangeColor: Record<RangeBand, string> = {
  VERY_LOW: "bg-range-very-low",
  LOW: "bg-range-low",
  IN_RANGE: "bg-range-in",
  HIGH: "bg-range-high",
  VERY_HIGH: "bg-range-very-high",
};

/**
 * 범위별 시간 비율 — 한 줄 누적 막대 + 범위 이름·비율 목록 (색만으로 구분하지 않는다).
 * 낮음이 왼쪽, 높음이 오른쪽 (순서 있는 척도). 조각 사이 2px 간격.
 */
export function RangeBar({ pct }: { pct: Record<RangeBand, number> }) {
  const order = [...RANGE_BANDS];
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">범위별 시간 비율</figcaption>
      <div
        className="flex h-5 w-full gap-0.5 overflow-hidden rounded"
        aria-hidden
      >
        {order
          .filter((b) => pct[b] > 0)
          .map((b) => (
            <div
              key={b}
              className={`${rangeColor[b]} h-full first:rounded-l last:rounded-r`}
              style={{ width: `${pct[b]}%`, minWidth: 3 }}
              title={`${rangeLabels[b]} ${pct[b]}%`}
            />
          ))}
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {[...order].reverse().map((b) => (
          <li key={b} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`${rangeColor[b]} size-3 rounded-sm`}
              />
              {rangeLabels[b]}
            </span>
            <span className={b === "IN_RANGE" ? "font-bold" : "font-semibold"}>
              {pct[b]}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
