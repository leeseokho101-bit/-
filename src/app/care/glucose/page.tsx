import Link from "next/link";
import { DayGlucoseChart } from "@/components/care/day-glucose-chart";
import { RangeBar } from "@/components/care/range-bar";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { glucoseNote, mealRiseLabels, mealTypeLabels } from "@/content/care";
import { glucoseStats, lowEvents, TIR_TARGETS } from "@/domain/glp1/cgm";
import { addDaysIso, kstDate, kstDayStart } from "@/domain/glp1/time";
import { formatDateTime, formatDay } from "@/features/care/format";
import { GlucoseUploadForm } from "@/features/care/misc-forms";
import { latestGlucose, listMeals, loadGlucose } from "@/features/care/service";
import { requireEnrollment } from "@/features/care/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";
import { cgmConnectors } from "@/server/integrations/cgm/connectors";

export const metadata = { title: "혈당 | GLP-1 케어" };

const PERIODS = [7, 14, 30] as const;

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-background flex flex-col gap-0.5 rounded-xl px-3 py-2">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-lg font-bold">{value}</span>
      {sub && <span className="text-muted text-xs">{sub}</span>}
    </div>
  );
}

export default async function CareGlucosePage({
  searchParams,
}: PageProps<"/care/glucose">) {
  const { user, today } = await requireEnrollment(routes.careGlucose);
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.days) ?? 14;
  const latest = await latestGlucose(db, user.id);
  // 기간의 끝은 마지막 측정일 (오래된 파일만 올렸어도 그 기간을 보여준다)
  const endDay =
    latest && kstDate(latest.t) < today ? kstDate(latest.t) : today;
  const from = kstDayStart(addDaysIso(endDay, -(days - 1)));
  const to = kstDayStart(addDaysIso(endDay, 1));
  const requestedDay =
    typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day)
      ? sp.day
      : null;
  const day = requestedDay && requestedDay <= today ? requestedDay : endDay;
  const dayFrom = kstDayStart(day);
  const dayTo = kstDayStart(addDaysIso(day, 1));

  const [points, dayPoints, meals] = await Promise.all([
    loadGlucose(db, user.id, from, to),
    loadGlucose(db, user.id, dayFrom, dayTo),
    listMeals(db, user.id, Math.min(from, dayFrom), Math.max(to, dayTo)),
  ]);
  const stats = glucoseStats(points, to - from);
  const lows = lowEvents(points);
  const dayMeals = meals.filter((m) => kstDate(m.eatenAt) === day);
  const responded = meals
    .filter((m) => m.eatenAt.getTime() >= from && m.response)
    .slice(0, 8);
  const href = (q: { days?: number; day?: string }) =>
    `${routes.careGlucose}?${new URLSearchParams({
      days: String(q.days ?? days),
      ...(q.day ? { day: q.day } : requestedDay ? { day: requestedDay } : {}),
    })}`;

  return (
    <>
      <PageHeader
        title="혈당(CGM)"
        description="목표 범위 안에 머문 시간과 식후 혈당 변화를 보여드려요."
      />

      {!latest ? (
        <Card className="flex flex-col gap-2">
          <p className="font-semibold">아직 혈당 기록이 없어요</p>
          <p className="text-muted text-sm leading-relaxed">
            CGM 앱에서 내보낸 파일을 아래에 올려 주세요.
          </p>
        </Card>
      ) : (
        <>
          <nav aria-label="기간" className="flex gap-2">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={href({ days: p })}
                aria-current={p === days ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${
                  p === days
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted"
                }`}
              >
                최근 {p}일
              </Link>
            ))}
          </nav>
          <Card className="flex flex-col gap-4">
            <p className="text-muted text-sm">
              {formatDay(addDaysIso(endDay, -(days - 1)))} ~ {formatDay(endDay)}
            </p>
            {stats ? (
              <>
                <div>
                  <p className="text-sm">목표 범위 안 시간</p>
                  <p className="text-3xl font-bold">{stats.pct.IN_RANGE}%</p>
                  <p className="text-muted text-xs">
                    참고 목표 {TIR_TARGETS.inRangeMin}% 이상 · 낮음(70 미만){" "}
                    {TIR_TARGETS.lowMax}% 미만
                  </p>
                </div>
                <RangeBar pct={stats.pct} />
                <div className="grid grid-cols-2 gap-2">
                  <Tile label="평균 혈당" value={`${stats.mean} mg/dL`} />
                  <Tile
                    label="예상 당화혈색소(GMI)"
                    value={`${stats.gmi}%`}
                    sub="검사 수치와 다를 수 있어요"
                  />
                  <Tile
                    label="변동계수(CV)"
                    value={`${stats.cv}%`}
                    sub={`참고 목표 ${TIR_TARGETS.cvMax}% 이하`}
                  />
                  <Tile
                    label="측정된 시간"
                    value={`${stats.coveragePct}%`}
                    sub={
                      stats.coveragePct < TIR_TARGETS.coverageMin
                        ? "70% 미만이라 참고만 해 주세요"
                        : undefined
                    }
                  />
                </div>
                <p className="text-sm">
                  70mg/dL 아래로 15분 넘게 내려간 구간:{" "}
                  <span className="font-semibold">{lows.length}번</span>
                  {lows.some((l) => l.level === 2) &&
                    ` (54mg/dL 아래 ${lows.filter((l) => l.level === 2).length}번)`}
                </p>
              </>
            ) : (
              <p className="text-muted text-sm">이 기간에는 기록이 없어요.</p>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Link
                href={href({ day: addDaysIso(day, -1) })}
                className="text-primary min-h-10 px-2 py-2 text-sm font-semibold"
                aria-label="전날"
              >
                ← 전날
              </Link>
              <h2 className="font-bold">{formatDay(day)}</h2>
              {day < today ? (
                <Link
                  href={href({ day: addDaysIso(day, 1) })}
                  className="text-primary min-h-10 px-2 py-2 text-sm font-semibold"
                  aria-label="다음날"
                >
                  다음날 →
                </Link>
              ) : (
                <span className="w-16" />
              )}
            </div>
            {dayPoints.length ? (
              <DayGlucoseChart
                points={dayPoints}
                dayStart={dayFrom}
                meals={dayMeals.map((m) => ({
                  at: m.eatenAt.getTime(),
                  label: mealTypeLabels[m.mealType],
                }))}
              />
            ) : (
              <p className="text-muted text-sm">이 날은 혈당 기록이 없어요.</p>
            )}
          </Card>

          <section className="flex flex-col gap-3" aria-labelledby="meal-resp">
            <h2 id="meal-resp" className="text-lg font-bold">
              식후 혈당 반응
            </h2>
            {responded.length === 0 ? (
              <p className="text-muted text-sm leading-relaxed">
                식사를 기록하면, 그 시각 전후의 혈당으로 식후 반응을 보여드려요.{" "}
                <Link
                  href={routes.careMeals}
                  className="text-primary underline"
                >
                  식사 기록하기
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {responded.map((m) => (
                  <li
                    key={m.id}
                    className="border-border bg-surface flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm"
                  >
                    <span className="flex justify-between gap-2">
                      <span className="font-semibold">
                        {formatDateTime(m.eatenAt)} {mealTypeLabels[m.mealType]}
                      </span>
                      <span>+{m.response!.rise} mg/dL</span>
                    </span>
                    <span className="text-muted">
                      {m.items.map((i) => i.name).join(", ")}
                    </span>
                    <span className="text-muted">
                      {mealRiseLabels[m.response!.band]} · 식전{" "}
                      {m.response!.baseline} → 최고 {m.response!.peak} (
                      {m.response!.minutesToPeak}분 뒤)
                      {m.response!.minutesToRecover !== null &&
                        ` · ${m.response!.minutesToRecover}분 뒤 회복`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">혈당 기록 가져오기</h2>
        <GlucoseUploadForm />
        <div className="border-border flex flex-col gap-1 border-t pt-3 text-sm">
          <p className="font-semibold">CGM 앱 자동 연동</p>
          <ul className="text-muted flex flex-col gap-0.5">
            {cgmConnectors.map((c) => (
              <li key={c.id}>
                {c.name} ·{" "}
                {c.status() === "available" ? "사용 가능" : "준비 중"}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <p className="text-muted bg-surface border-border rounded-xl border p-3 text-xs leading-relaxed">
        {glucoseNote}
      </p>
    </>
  );
}
