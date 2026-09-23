import { DomainCard } from "@/components/report/domain-card";
import { NoReport } from "@/components/report/no-report";
import { ReportFootnote } from "@/components/report/report-footnote";
import { PageHeader } from "@/components/ui/page-header";
import { domainContent } from "@/content/domains";
import type { DomainResult } from "@/domain/analysis/types";
import { getLatestReport } from "@/features/analysis/queries";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "나의 건강 프로파일 | 입체적 건강분석" };

export default async function ProfileReportPage() {
  const user = await requireUser(routes.reportProfile);
  const report = await getLatestReport(user.id);
  if (!report) return <NoReport />;

  const groups: { title: string; domains: DomainResult[] }[] = [
    {
      title: "검진 수치로 보는 영역",
      domains: report.domains.filter(
        (d) => domainContent[d.domain].kind === "BODY",
      ),
    },
    {
      title: "생활습관으로 보는 영역",
      domains: report.domains.filter(
        (d) => domainContent[d.domain].kind === "HABIT",
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="10개 건강영역"
        title="나의 건강 프로파일"
        description="점(●)이 많을수록 관리가 더 필요한 영역이에요. 카드의 '판단 근거 보기'를 누르면 수치를 확인할 수 있어요."
      />
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{g.title}</h2>
          {g.domains.map((d) => (
            <DomainCard
              key={d.domain}
              domain={d}
              explanation={report.narrative.domains[d.domain]}
            />
          ))}
        </section>
      ))}
      <ReportFootnote report={report} />
    </>
  );
}
