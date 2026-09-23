import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { getAssessmentStep, type AssessmentStepSlug } from "@/lib/routes";
import { StepProgress } from "./step-progress";

/** 입력 단계 공통 레이아웃: 진행률 → 제목 → 본문(StepForm) */
export function StepPage({
  slug,
  children,
}: {
  slug: AssessmentStepSlug;
  children: ReactNode;
}) {
  const { step } = getAssessmentStep(slug);
  return (
    <>
      <StepProgress slug={slug} />
      <PageHeader title={step.title} description={step.description} />
      {children}
    </>
  );
}
