import { DomainStatusList } from "@/components/report/domain-status-list";
import { NoReport } from "@/components/report/no-report";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";
import { getLatestReport } from "@/features/analysis/queries";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "나의 건강 프로파일 | 입체적 건강분석" };

export default async function ProfileReportPage() {
  const user = await requireUser(routes.reportProfile);
  const report = await getLatestReport(user.id);
  if (!report) return <NoReport />;
  return (
    <>
      <PageHeader
        eyebrow="10개 건강영역"
        title="나의 건강 프로파일"
        description="점(●)이 많을수록 관리가 더 필요한 영역이에요."
      />
      <DomainStatusList
        domains={report.domains}
        explanations={report.narrative.domains}
      />
      <Placeholder label="영역별 쉬운 설명 · 판단 근거 카드" step={8} />
    </>
  );
}
