import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { KeyMetricsTable } from "@/components/report/key-metrics-table";
import { NoReport } from "@/components/report/no-report";
import { HealthOverview } from "@/components/report/overview";
import { PriorityCard } from "@/components/report/priority-card";
import { ReportFootnote } from "@/components/report/report-footnote";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";
import { LevelDots, StatusBadge } from "@/components/ui/status-badge";
import { domainContent } from "@/content/domains";
import { buildKeyMetrics } from "@/features/analysis/key-metrics";
import { getLatestReport } from "@/features/analysis/queries";
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

  const byCode = new Map(report.domains.map((d) => [d.domain, d]));
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

      {/* 5. 12주 건강관리 / 6. 최근 변화 */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="12주 건강관리" href={routes.reportPlan} />
        <Placeholder label="이번 주 목표 · 실천 체크" step={9} />
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle title="최근 변화" />
        <Placeholder
          label="주간 체크 · 체중 변화 · 이전 분석과 비교"
          step={9}
        />
      </section>

      <ReportFootnote report={report} />
    </PageContainer>
  );
}
