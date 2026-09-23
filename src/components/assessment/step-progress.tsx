import { getAssessmentStep, type AssessmentStepSlug } from "@/lib/routes";

export function StepProgress({ slug }: { slug: AssessmentStepSlug }) {
  const { number, total, step } = getAssessmentStep(slug);
  const percent = Math.round((number / total) * 100);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm">
        <span className="text-foreground font-semibold">
          {number} / {total}
        </span>{" "}
        단계 · {step.title}
      </p>
      <div
        className="bg-border h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={number}
        aria-label={`전체 ${total}단계 중 ${number}단계`}
      >
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
