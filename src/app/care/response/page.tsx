import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { careDisclaimer } from "@/content/care";
import { formatDose } from "@/domain/glp1/drugs";
import { addDaysIso, DAY_MS, kstDayStart } from "@/domain/glp1/time";
import {
  doseDayProfile,
  dosePeriods,
  BEFORE_START_DAYS,
} from "@/domain/glp1/timeline";
import { formatDay } from "@/features/care/format";
import {
  listCheckIns,
  listDoses,
  listMeals,
  loadGlucose,
} from "@/features/care/service";
import { requireEnrollment } from "@/features/care/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "약물 반응 타임라인 | GLP-1 케어" };

/** 최대 조회 기간 (일) */
const MAX_DAYS = 120;

const fmt = (a: { avg: number } | null, unit = "") =>
  a ? `${a.avg}${unit}` : "-";

export default async function CareResponsePage() {
  const {
    user,
    enrollment: e,
    today,
  } = await requireEnrollment(routes.careResponse);
  const fromDay = addDaysIso(today, -(MAX_DAYS - 1));
  const from = kstDayStart(fromDay);
  const to = kstDayStart(addDaysIso(today, 1));
  const [doses, checkIns, glucose, meals] = await Promise.all([
    listDoses(db, user.id, new Date(from - BEFORE_START_DAYS * DAY_MS)),
    listCheckIns(db, user.id, today, MAX_DAYS),
    loadGlucose(db, user.id, from - BEFORE_START_DAYS * DAY_MS, to),
    listMeals(db, user.id, from, to),
  ]);
  const inputs = {
    checkIns,
    glucose,
    mealRises: meals.flatMap((m) =>
      m.response ? [{ at: m.eatenAt.getTime(), rise: m.response.rise }] : [],
    ),
  };
  const periods = dosePeriods(doses, inputs, e.startDate, today);
  const weekly = e.drug.intervalDays === 7;
  const profile = weekly ? doseDayProfile(doses, inputs, today) : [];
  const hasProfile = profile.some(
    (r) => r.appetite || r.meanGlucose || r.nausea,
  );
  const maxAppetite = 10;

  return (
    <>
      <PageHeader
        title="나의 약물 반응 타임라인"
        description="투약 시점·용량에 맞춰 식욕, 속 불편함, 혈당 변화를 나란히 모아 봤어요. 진료 때 담당 의사에게 보여 주셔도 좋아요."
      />

      {weekly && (
        <section className="flex flex-col gap-3" aria-labelledby="dose-day">
          <h2 id="dose-day" className="text-lg font-bold">
            투약 후 날짜별 변화
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            최근 4번의 투약을 기준으로, 투약한 날(0일)부터 6일째까지 평균이에요.
          </p>
          {!hasProfile ? (
            <Card className="text-muted text-sm">
              투약과 체크인을 기록하면 여기에 쌓여요.
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <div
                tabIndex={0}
                role="region"
                aria-label="투약 후 경과일별 평균 표"
                className="overflow-x-auto"
              >
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">투약 후 경과일별 평균</caption>
                  <thead>
                    <tr className="text-muted">
                      <th className="py-1 font-medium">투약 후</th>
                      <th className="py-1 font-medium">식욕 (0~10)</th>
                      <th className="py-1 text-right font-medium">메스꺼움</th>
                      <th className="py-1 text-right font-medium">평균 혈당</th>
                      <th className="py-1 text-right font-medium">식후 상승</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.map((r) => (
                      <tr key={r.offset} className="border-border border-t">
                        <td className="py-1.5 whitespace-nowrap">
                          {r.offset}일째
                        </td>
                        <td className="py-1.5">
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="bg-chart-track h-2 w-16 overflow-hidden rounded-full"
                            >
                              {r.appetite && (
                                <span
                                  className="bg-chart-1 block h-full rounded-full"
                                  style={{
                                    width: `${(r.appetite.avg / maxAppetite) * 100}%`,
                                  }}
                                />
                              )}
                            </span>
                            {fmt(r.appetite)}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">{fmt(r.nausea)}</td>
                        <td className="py-1.5 text-right">
                          {fmt(r.meanGlucose)}
                        </td>
                        <td className="py-1.5 text-right">
                          {r.mealRise ? `+${r.mealRise.avg}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-muted mt-2 text-xs">
                  메스꺼움: 0 없음 ~ 3 심함 · 혈당 단위 mg/dL
                </p>
              </div>
            </Card>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="by-dose">
        <h2 id="by-dose" className="text-lg font-bold">
          용량별 비교
        </h2>
        {periods.length === 0 ? (
          <Card className="text-muted text-sm">
            투약을 기록하면 용량별로 비교해 드려요.
          </Card>
        ) : (
          <ol className="flex flex-col gap-2">
            {periods.map((p) => (
              <li key={p.from}>
                <Card className="flex flex-col gap-2">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">
                      {p.doseMg === null
                        ? "투약 시작 전"
                        : formatDose(p.doseMg)}
                    </span>
                    <span className="text-muted text-xs">
                      {formatDay(p.from)} ~ {formatDay(p.to)} · {p.days}일
                    </span>
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted">목표 범위 안 시간</dt>
                    <dd className="text-right font-semibold">
                      {p.glucose ? `${p.glucose.pct.IN_RANGE}%` : "-"}
                    </dd>
                    <dt className="text-muted">평균 혈당</dt>
                    <dd className="text-right font-semibold">
                      {p.glucose ? `${p.glucose.mean} mg/dL` : "-"}
                    </dd>
                    <dt className="text-muted">평균 식후 상승</dt>
                    <dd className="text-right font-semibold">
                      {p.mealRise ? `+${p.mealRise.avg} mg/dL` : "-"}
                    </dd>
                    <dt className="text-muted">평균 식욕</dt>
                    <dd className="text-right font-semibold">
                      {fmt(p.appetite, " / 10")}
                    </dd>
                    <dt className="text-muted">평균 메스꺼움</dt>
                    <dd className="text-right font-semibold">
                      {fmt(p.nausea, " / 3")}
                    </dd>
                    <dt className="text-muted">체중 변화</dt>
                    <dd className="text-right font-semibold">
                      {p.weightChange === null
                        ? "-"
                        : `${p.weightChange > 0 ? "+" : ""}${p.weightChange}kg`}
                    </dd>
                  </dl>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-muted bg-surface border-border rounded-xl border p-3 text-xs leading-relaxed">
        평균은 기록이 있는 날만으로 계산해요. 기록이 적으면 실제와 다를 수
        있어요. {careDisclaimer}
      </p>
    </>
  );
}
