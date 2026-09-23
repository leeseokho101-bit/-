import { PageContainer } from "@/components/layout/page-container";
import { ReportTabs } from "@/components/report/report-tabs";

export default function ReportLayout({ children }: LayoutProps<"/report">) {
  return (
    <PageContainer>
      <ReportTabs />
      {children}
    </PageContainer>
  );
}
