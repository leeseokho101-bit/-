/** 체중 변화 숫자 카드 — 값이 몇 개뿐이라 차트 대신 시작·최근·변화량을 보여준다 */
export function WeightTile({
  baseline,
  latest,
  latestWeek,
}: {
  baseline: number | null;
  latest: number | null;
  latestWeek: number | null;
}) {
  if (latest === null || baseline === null) {
    return (
      <div className="border-border bg-surface rounded-2xl border p-4">
        <p className="text-sm font-semibold">체중 변화</p>
        <p className="text-muted mt-1 text-sm">
          주간 체크에서 체중을 기록하면 변화를 보여드려요.
        </p>
      </div>
    );
  }
  const diff = Math.round((latest - baseline) * 10) / 10;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return (
    <div className="border-border bg-surface flex flex-col gap-2 rounded-2xl border p-4">
      <p className="text-sm font-semibold">체중 변화</p>
      <p className="text-3xl font-bold">
        {sign}
        {Math.abs(diff)} kg
      </p>
      <p className="text-muted text-sm">
        시작 {baseline} kg → {latestWeek}주차 {latest} kg
      </p>
    </div>
  );
}
