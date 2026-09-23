import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";
import { routes } from "@/lib/routes";

export const metadata = { title: "서비스 소개 | 입체적 건강분석" };

export default function AboutPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="서비스 소개"
        title="어떻게 분석하나요?"
        description="건강검진 수치와 생활습관을 함께 살펴보고, 지금 먼저 관리하면 좋은 영역을 알려드립니다."
      />
      <Placeholder
        label="분석 과정 · 10개 건강영역 · 의료행위 아님 고지"
        step={4}
      />
      <ButtonLink href={routes.assessment}>내 건강 분석하기</ButtonLink>
    </PageContainer>
  );
}
