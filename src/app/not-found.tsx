import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <PageContainer>
      <PageHeader
        title="페이지를 찾을 수 없어요"
        description="주소를 다시 확인해 주세요."
      />
      <ButtonLink href={routes.home}>처음으로</ButtonLink>
    </PageContainer>
  );
}
