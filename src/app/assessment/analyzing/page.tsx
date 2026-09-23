import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";
import { routes } from "@/lib/routes";

export const metadata = { title: "분석 중 | 입체적 건강분석" };

export default function AnalyzingPage() {
  return (
    <>
      <PageHeader
        title="건강정보를 종합하고 있어요"
        description="검진 수치, 생활습관, 복용약 정보를 함께 살펴보는 중입니다."
      />
      <Placeholder
        label="분석 진행 표시 → 완료 시 결과 화면으로 이동"
        step={6}
      />
      <ButtonLink href={routes.report} className="mt-auto">
        결과 보기 (임시)
      </ButtonLink>
    </>
  );
}
