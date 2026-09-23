"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import { ButtonLink } from "@/components/ui/button-link";
import { submitAssessment } from "./actions";

export function SubmitAssessmentForm({ prevHref }: { prevHref: string }) {
  const [state, action] = useActionState(submitAssessment, {});
  return (
    <form action={action} className="mt-auto flex flex-col gap-3 pt-4">
      <FormMessage message={state.message} />
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <ButtonLink href={prevHref} variant="secondary">
          이전
        </ButtonLink>
        <SubmitButton pendingText="분석 요청 중…">분석 시작</SubmitButton>
      </div>
    </form>
  );
}
