import { NoReport } from "@/components/report/no-report";
import { ReportFootnote } from "@/components/report/report-footnote";
import { HealthOverview } from "@/components/report/overview";
import { PriorityCard } from "@/components/report/priority-card";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getLatestReport } from "@/features/analysis/queries";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "건강분석 결과 | 입체적 건강분석" };

export default async function ReportPage() {
  const user = await requireUser(routes.report);
  const report = await getLatestReport(user.id);
  if (!report) return <NoReport />;

  const byCode = new Map(report.domains.map((d) => [d.domain, d]));
  const texts = new Map(report.narrative.priorities.map((p) => [p.domain, p]));
  const maintainOnly = report.priorities.every((p) => p.mode === "MAINTAIN");

  return (
    <>
      <PageHeader
        eyebrow="분석 결과"
        title={`${user.displayName}님의 건강분석 결과`}
      />
      <HealthOverview
        domains={report.domains}
        summary={report.narrative.summary}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">
          {maintainOnly
            ? "유지하면 좋은 건강습관 TOP 3"
            : "건강관리 우선순위 TOP 3"}
        </h2>
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

      <Card className="bg-primary/5 border-primary/20 leading-relaxed">
        {report.narrative.encouragement}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <ButtonLink href={routes.reportProfile} variant="secondary">
          건강 프로파일
        </ButtonLink>
        <ButtonLink href={routes.reportPlan}>12주 계획 보기</ButtonLink>
      </div>
      <ReportFootnote report={report} />
    </>
  );
}
