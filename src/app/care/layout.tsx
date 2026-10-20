import { CareTabs } from "@/components/care/care-tabs";
import { PageContainer } from "@/components/layout/page-container";
import { getEnrollment } from "@/features/care/service";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

/** GLP-1 케어(환자 앱). 등록한 사용자에게만 하단 메뉴를 보여준다 */
export default async function CareLayout({ children }: LayoutProps<"/care">) {
  const user = await requireUser(routes.care);
  const enrolled = !!(await getEnrollment(db, user.id));
  return (
    <>
      <PageContainer>{children}</PageContainer>
      {enrolled && <CareTabs />}
    </>
  );
}
