import { Meter } from "@/components/charts/meter";
import { NoReport } from "@/components/report/no-report";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { domainContent } from "@/content/domains";
import { phaseInfo, type PlanPhase } from "@/domain/plan/library";
import { getLatestReport } from "@/features/analysis/queries";
import { CheckInForm } from "@/features/plan/check-in-form";
import { getPlanView, type PlanWeekView } from "@/features/plan/queries";
import { ensurePlan } from "@/features/plan/service";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "12주 건강관리 계획 | 입체적 건강분석" };

const PHASES: PlanPhase[] = ["FOUNDATION", "ACTIVATION", "MAINTENANCE"];

function rateText(w: PlanWeekView, currentWeek: number) {
  if (w.weekNumber > currentWeek) return "예정";
  if (w.rate === null) return "기록 없음";
  return `실천율 ${Math.round(w.rate * 100)}%`;
}

function WeekBody({ week }: { week: PlanWeekView }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="leading-relaxed">
        <span className="text-muted text-sm font-semibold">목표 · </span>
        {week.goal}
      </p>
      <div>
        <p className="text-muted mb-1 text-sm font-semibold">실천 항목</p>
        <ul className="flex flex-col gap-1.5">
          {week.actions.map((a) => (
            <li key={a.id} className="flex gap-2 leading-relaxed">
              <span aria-hidden className="text-primary">
                •
              </span>
              <span>
                {a.text}
                {a.domain && (
                  <span className="text-muted ml-1 text-xs">
                    ({domainContent[a.domain].label})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {week.coaching && (
        <p className="bg-primary/5 rounded-xl px-4 py-3 text-sm leading-relaxed">
          <span className="text-primary font-semibold">코칭 · </span>
          {week.coaching}
        </p>
      )}
    </div>
  );
}

export default async function PlanPage() {
  const user = await requireUser(routes.reportPlan);
  let plan = await getPlanView(user.id);
  if (!plan) {
    // STEP 9 이전에 분석한 결과에는 계획이 없을 수 있다 → 템플릿 계획 생성
    const report = await getLatestReport(user.id);
    if (!report) return <NoReport />;
    await ensurePlan(db, report.assessmentId, null);
    plan = await getPlanView(user.id);
    if (!plan) return <NoReport />;
  }

  const current = plan.weeks.find((w) => w.weekNumber === plan.currentWeek)!;
  const currentPhase = current.phase;
  const recorded = plan.weeks.filter((w) => w.rate !== null).length;

  return (
    <>
      <PageHeader
        eyebrow="12주 건강관리"
        title={
          plan.finished
            ? "12주 계획을 마쳤어요"
            : `${plan.currentWeek}주차 진행 중`
        }
        description={`시작일 ${plan.startDate.toLocaleDateString("ko-KR")} · 우선순위 TOP 3를 바탕으로 만든 계획이에요.`}
      />

      {/* 단계 */}
      <ol className="grid grid-cols-3 gap-2" aria-label="12주 단계">
        {PHASES.map((p) => {
          const info = phaseInfo[p];
          const active = p === currentPhase;
          return (
            <li
              key={p}
              aria-current={active ? "step" : undefined}
              className={`rounded-xl border px-2 py-2.5 text-center ${active ? "border-primary bg-primary/5" : "border-border bg-surface"}`}
            >
              <p
                className={`text-xs ${active ? "text-primary font-bold" : "text-muted"}`}
              >
                {info.weeks[0]}~{info.weeks[1]}주 {active && "· 지금"}
              </p>
              <p className="mt-0.5 text-sm leading-snug font-semibold">
                {info.title}
              </p>
            </li>
          );
        })}
      </ol>

      <Card>
        <Meter
          value={recorded / 12}
          label={`체크 기록한 주 ${recorded} / 12`}
        />
      </Card>

      {/* 이번 주 */}
      <Card className="border-primary/40 flex flex-col gap-4">
        <h2 className="text-xl font-bold">
          이번 주 · {current.weekNumber}주차{" "}
          <span className="text-muted text-sm font-normal">
            {phaseInfo[current.phase].title}
          </span>
        </h2>
        <WeekBody week={current} />
        <CheckInForm
          key={current.weekNumber}
          weekNumber={current.weekNumber}
          checks={current.checks}
          completed={current.completed}
          weight={current.weight}
        />
      </Card>

      {/* 전체 주차 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">전체 12주</h2>
        {plan.weeks.map((w) => (
          <details
            key={w.weekNumber}
            className="border-border bg-surface rounded-2xl border px-4 py-3"
            open={false}
          >
            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2">
              <span className="font-semibold">
                {w.weekNumber}주차
                {w.weekNumber === plan.currentWeek && (
                  <span className="text-primary ml-1 text-xs">이번 주</span>
                )}
              </span>
              <span className="text-muted text-sm">
                {rateText(w, plan.currentWeek)}
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <WeekBody week={w} />
              {w.weekNumber < plan.currentWeek && (
                <CheckInForm
                  weekNumber={w.weekNumber}
                  checks={w.checks}
                  completed={w.completed}
                  weight={w.weight}
                />
              )}
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
