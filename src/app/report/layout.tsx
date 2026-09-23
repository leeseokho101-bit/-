import { PageContainer } from "@/components/layout/page-container";
import { ReportTabs } from "@/components/report/report-tabs";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export default async function ReportLayout({
  children,
}: LayoutProps<"/report">) {
  await requireUser(routes.report);
  return (
    <PageContainer>
      <ReportTabs />
      {children}
    </PageContainer>
  );
}
