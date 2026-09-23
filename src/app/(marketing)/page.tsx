import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button-link";
import { Placeholder } from "@/components/ui/placeholder";
import { routes } from "@/lib/routes";

export default function LandingPage() {
  return (
    <PageContainer>
      <section className="flex flex-col gap-5 pt-6">
        <p className="text-primary text-sm font-semibold">입체적 건강분석</p>
        <h1 className="text-3xl leading-snug font-bold">
          내 건강을 하나씩 보는 것이 아니라, 전체적으로 분석합니다.
        </h1>
        <p className="text-muted leading-relaxed">
          건강검진, 생활습관, 복용약 정보를 종합하여 지금 내가 가장 먼저
          관리해야 할 건강영역을 찾아드립니다.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <ButtonLink href={routes.assessment}>내 건강 분석하기</ButtonLink>
          <ButtonLink href={routes.about} variant="secondary">
            서비스 소개 보기
          </ButtonLink>
        </div>
      </section>
      <Placeholder label="서비스 특징 · 분석 과정 안내" step={4} />
    </PageContainer>
  );
}
