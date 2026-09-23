/**
 * 12주 주간 실천율 막대 차트 (단일 계열 → 범례 없음, 제목이 계열 이름)
 * - 막대 ≤24px, 위쪽만 4px 둥글게, 하나의 기준선에서 시작
 * - 현재 주차 값은 제목 줄에 표시 (막대 위 라벨은 옆 막대와 겹칠 수 있어 쓰지 않음), 나머지는 툴팁
 * - 막대마다 "n주차 · 67%" 라벨 (스크린리더), 기록 없는 주는 짧은 선으로 구분
 */
export type WeeklyPoint = {
  week: number;
  rate: number | null;
  future: boolean;
};

const HEIGHT = 112; // px, 막대 영역

export function WeeklyCompletionChart({
  points,
  currentWeek,
}: {
  points: WeeklyPoint[];
  currentWeek: number;
}) {
  const current = points.find((p) => p.week === currentWeek);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-muted">주차별 체크 항목 실천율</span>
        {current?.rate != null && (
          <span className="font-semibold">
            이번 주 {Math.round(current.rate * 100)}%
          </span>
        )}
      </figcaption>
      <div className="relative">
        {/* 50%·100% 보조선 (흐리게) */}
        <div
          aria-hidden
          className="border-border absolute inset-x-0 top-0 border-t border-dashed"
        />
        <div
          aria-hidden
          className="border-border absolute inset-x-0 border-t border-dashed"
          style={{ top: HEIGHT / 2 }}
        />
        <div
          className="relative flex items-end justify-between gap-0.5"
          style={{ height: HEIGHT }}
        >
          {points.map((p) => {
            const pct = p.rate === null ? 0 : Math.round(p.rate * 100);
            const tip = p.future
              ? `${p.week}주차 · 예정`
              : p.rate === null
                ? `${p.week}주차 · 기록 없음`
                : `${p.week}주차 · ${pct}%`;
            return (
              <div
                key={p.week}
                className="group relative flex h-full flex-1 items-end justify-center"
                tabIndex={p.future ? -1 : 0}
                title={tip}
                role="img"
                aria-label={tip}
              >
                {p.rate !== null && pct > 0 && (
                  <div
                    className="bg-chart-1 w-full max-w-6 rounded-t"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                )}
                {!p.future && p.rate === null && (
                  <div className="bg-border h-0.5 w-3" />
                )}
                <span
                  aria-hidden
                  className="bg-foreground pointer-events-none absolute -top-8 z-10 hidden rounded-md px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus:block"
                >
                  {tip}
                </span>
              </div>
            );
          })}
        </div>
        <div className="border-muted/40 border-t" />
        <div aria-hidden className="mt-1 flex justify-between gap-0.5">
          {points.map((p) => (
            <span
              key={p.week}
              className={`flex-1 text-center text-[0.7rem] ${p.week === currentWeek ? "text-foreground font-bold" : "text-muted"}`}
            >
              {p.week}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
