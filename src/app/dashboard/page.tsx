import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { KeyMetricsTable } from "@/components/report/key-metrics-table";
import { NoReport } from "@/components/report/no-report";
import { HealthOverview } from "@/components/report/overview";
import { PriorityCard } from "@/components/report/priority-card";
import { ReportFootnote } from "@/components/report/report-footnote";
import { PageHeader } from "@/components/ui/page-header";
import { Meter } from "@/components/charts/meter";
import { WeeklyCompletionChart } from "@/components/charts/weekly-completion-chart";
import { WeightTile } from "@/components/charts/weight-tile";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { LevelDots, StatusBadge } from "@/components/ui/status-badge";
import { domainContent } from "@/content/domains";
import { buildKeyMetrics } from "@/features/analysis/key-metrics";
import { getLatestReport } from "@/features/analysis/queries";
import { getAnalysisComparison, getPlanView } from "@/features/plan/queries";
import { phaseInfo } from "@/domain/plan/library";
import { statusContent } from "@/content/domains";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "대시보드 | 입체적 건강분석" };

function SectionTitle({
  title,
  href,
  linkLabel = "자세히",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-primary text-sm font-semibold underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser(routes.dashboard);
  const report = await getLatestReport(user.id);

  if (!report) {
    return (
      <PageContainer>
        <PageHeader title={`${user.displayName}님의 대시보드`} />
        <NoReport />
      </PageContainer>
    );
  }

  const [plan, comparison] = await Promise.all([
    getPlanView(user.id),
    getAnalysisComparison(user.id),
  ]);
  const byCode = new Map(report.domains.map((d) => [d.domain, d]));
  const thisWeek = plan?.weeks.find((w) => w.weekNumber === plan.currentWeek);
  const weighed =
    plan?.weeks.filter(
      (w) => w.weight !== null && w.weekNumber <= plan.currentWeek,
    ) ?? [];
  const lastWeighed = weighed.at(-1);
  const changed =
    comparison?.changes.filter(
      (c) => c.direction === "improved" || c.direction === "worsened",
    ) ?? [];
  const texts = new Map(report.narrative.priorities.map((p) => [p.domain, p]));

  return (
    <PageContainer>
      <PageHeader title={`${user.displayName}님의 대시보드`} />

      {/* 1. 건강 한눈에 보기 */}
      <HealthOverview
        domains={report.domains}
        summary={report.narrative.summary}
      />

      {/* 2. 나의 건강 프로파일 */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="나의 건강 프로파일" href={routes.reportProfile} />
        <ul className="grid grid-cols-2 gap-2">
          {report.domains.map((d) => (
            <li
              key={d.domain}
              className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-3"
            >
              <span className="font-semibold">
                {domainContent[d.domain].label}
              </span>
              <LevelDots level={d.level} />
              <StatusBadge status={d.status} />
            </li>
          ))}
        </ul>
      </section>

      {/* 3. 건강관리 우선순위 TOP 3 */}
      <section className="flex flex-col gap-3">
        <SectionTitle
          title="건강관리 우선순위 TOP 3"
          href={routes.reportPriorities}
        />
        <ol className="flex flex-col gap-3">
          {report.priorities.map((p) => (
            <li key={p.domain}>
              <PriorityCard
                priority={p}
                domain={byCode.get(p.domain)!}
                text={texts.get(p.domain)}
                compact
              />
            </li>
          ))}
        </ol>
      </section>

      {/* 4. 주요 건강 데이터 */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="주요 건강 데이터" />
        <KeyMetricsTable
          metrics={buildKeyMetrics(report.domains, report.sex)}
        />
      </section>

      {/* 5. 12주 건강관리 */}
      <section className="flex flex-col gap-3">
        <SectionTitle
          title="12주 건강관리"
          href={routes.reportPlan}
          linkLabel="계획 보기"
        />
        {plan && thisWeek ? (
          <Card className="flex flex-col gap-3">
            <p className="text-muted text-sm">
              {plan.currentWeek}주차 · {phaseInfo[thisWeek.phase].title}
            </p>
            <p className="leading-relaxed">{thisWeek.goal}</p>
            <Meter value={thisWeek.rate ?? 0} label="이번 주 실천율" />
            <ButtonLink href={routes.reportPlan}>이번 주 체크하기</ButtonLink>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3">
            <p className="text-muted">
              분석 결과를 바탕으로 12주 계획을 만들 수 있어요.
            </p>
            <ButtonLink href={routes.reportPlan}>12주 계획 만들기</ButtonLink>
          </Card>
        )}
      </section>

      {/* 6. 최근 변화 */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="최근 변화" />
        {plan && (
          <Card>
            <WeeklyCompletionChart
              currentWeek={plan.currentWeek}
              points={plan.weeks.map((w) => ({
                week: w.weekNumber,
                rate: w.rate,
                future: w.weekNumber > plan.currentWeek,
              }))}
            />
          </Card>
        )}
        <WeightTile
          baseline={plan?.baselineWeight ?? null}
          latest={lastWeighed?.weight ?? null}
          latestWeek={lastWeighed?.weekNumber ?? null}
        />
        {comparison && (
          <Card className="flex flex-col gap-2">
            <p className="text-sm font-semibold">
              이전 분석({comparison.previousDate.toLocaleDateString("ko-KR")})과
              비교
            </p>
            {changed.length === 0 ? (
              <p className="text-muted text-sm">영역별 상태가 이전과 같아요.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {changed.map((c) => (
                  <li
                    key={c.domain}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="font-medium">
                      {domainContent[c.domain].label}
                    </span>
                    <span>
                      {statusContent[c.from].label} →{" "}
                      {statusContent[c.to].label}{" "}
                      <span
                        className={
                          c.direction === "improved"
                            ? "text-emerald-800"
                            : "text-rose-800"
                        }
                      >
                        {c.direction === "improved"
                          ? "▲ 좋아짐"
                          : "▼ 관리 필요"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </section>

      <ReportFootnote report={report} />
    </PageContainer>
  );
}
