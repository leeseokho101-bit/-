import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";
import { assessmentStepPath, assessmentSteps } from "@/lib/routes";

export const metadata = { title: "건강분석 시작 | 입체적 건강분석" };

export default function AssessmentStartPage() {
  return (
    <>
      <PageHeader
        eyebrow="건강분석 시작"
        title="약 5분이면 충분해요"
        description="아래 순서대로 입력합니다. 모르는 항목은 건너뛰어도 괜찮아요."
      />
      <Card>
        <ol className="flex flex-col gap-3">
          {assessmentSteps.map((s, i) => (
            <li key={s.slug} className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-bold">
                {i + 1}
              </span>
              <span className="font-medium">{s.title}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Placeholder
        label="개인정보·건강정보 수집 동의 (항목·목적·보관기간)"
        step={4}
      />
      <ButtonLink href={assessmentStepPath("profile")} className="mt-auto">
        동의하고 시작하기
      </ButtonLink>
    </>
  );
}
