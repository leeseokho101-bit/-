import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/page-header";
import { getAssessmentStep, type AssessmentStepSlug } from "@/lib/routes";
import { StepProgress } from "./step-progress";

/**
 * 입력 단계 공통 레이아웃: 진행률 → 제목 → 본문 → 이전/다음
 * STEP 4에서 "다음"은 폼 제출(Server Action) 버튼으로 교체됩니다.
 */
export function StepPage({
  slug,
  nextLabel = "다음",
  children,
}: {
  slug: AssessmentStepSlug;
  nextLabel?: string;
  children: ReactNode;
}) {
  const { step, prevPath, nextPath } = getAssessmentStep(slug);
  return (
    <>
      <StepProgress slug={slug} />
      <PageHeader title={step.title} description={step.description} />
      {children}
      <div className="mt-auto grid grid-cols-[1fr_2fr] gap-3 pt-4">
        <ButtonLink href={prevPath} variant="secondary">
          이전
        </ButtonLink>
        <ButtonLink href={nextPath}>{nextLabel}</ButtonLink>
      </div>
    </>
  );
}
