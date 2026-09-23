import Link from "next/link";
import { StepPage } from "@/components/assessment/step-page";
import { Card } from "@/components/ui/card";
import { loadStep } from "@/features/assessment/load-step";
import { buildReviewSummary } from "@/features/assessment/review-summary";
import { SubmitAssessmentForm } from "@/features/assessment/submit-form";
import { assessmentStepPath } from "@/lib/routes";

export const metadata = { title: "입력 확인 | 입체적 건강분석" };

export default async function ReviewStepPage() {
  const { inputs, prevHref } = await loadStep("review");
  const sections = buildReviewSummary(inputs);

  return (
    <StepPage slug="review">
      {sections.map((section) => {
        const filled = section.rows.filter((r) => r.value !== null).length;
        return (
          <Card key={section.title}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {section.title}{" "}
                <span className="text-muted text-sm font-normal">
                  ({filled}/{section.rows.length} 입력)
                </span>
              </h2>
              <Link
                href={assessmentStepPath(section.step)}
                className="text-primary text-sm font-semibold underline"
              >
                수정
              </Link>
            </div>
            <dl className="divide-border divide-y text-sm">
              {section.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between gap-4 py-2"
                >
                  <dt className="text-muted shrink-0">{row.label}</dt>
                  <dd
                    className={
                      row.value
                        ? "text-right font-medium"
                        : "text-muted text-right"
                    }
                  >
                    {row.value ?? "미입력"}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        );
      })}
      <p className="text-muted text-sm leading-relaxed">
        입력하지 않은 항목은 분석에서 &lsquo;데이터 부족&rsquo;으로 표시됩니다.
        그래도 분석은 가능해요.
      </p>
      <SubmitAssessmentForm prevHref={prevHref} />
    </StepPage>
  );
}
