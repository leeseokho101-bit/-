"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/form/field";
import { buttonBase } from "@/components/ui/button-link";
import { stopNote, stopReasonLabels } from "@/content/care";
import { treatmentStopAction } from "./actions";
import {
  FieldError,
  FormFeedback,
  SubmitButton,
  submitWith,
} from "./form-bits";

/** 치료 중단 기록 / 다시 시작 */
export function TreatmentStopForm({
  stopped,
  today,
}: {
  stopped: { date: string; reason: keyof typeof stopReasonLabels } | null;
  today: string;
}) {
  const [state, action, pending] = useActionState(treatmentStopAction, {});
  const errors = state.fieldErrors ?? {};
  if (stopped)
    return (
      <form
        onSubmit={submitWith(action)}
        className="flex flex-col gap-3"
        noValidate
      >
        <input type="hidden" name="resume" value="1" />
        <p className="text-sm leading-relaxed">
          {stopped.date}에 치료를 그만둔 것으로 기록했어요 (
          {stopReasonLabels[stopped.reason]}).
        </p>
        <FormFeedback state={state} />
        <button
          type="submit"
          disabled={pending}
          className={`${buttonBase} border-border bg-surface w-full border disabled:opacity-60`}
        >
          다시 시작했어요
        </button>
      </form>
    );
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-3"
      noValidate
    >
      <p className="text-muted text-sm leading-relaxed">{stopNote}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stop-date" className="text-sm font-semibold">
            그만둔 날
          </label>
          <input
            id="stop-date"
            name="date"
            type="date"
            max={today}
            defaultValue={today}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stop-reason" className="text-sm font-semibold">
            이유
          </label>
          <select
            id="stop-reason"
            name="reason"
            defaultValue=""
            className={inputClass}
          >
            <option value="">골라 주세요</option>
            {Object.entries(stopReasonLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FieldError message={errors.date ?? errors.reason} />
      <FormFeedback state={state} />
      <SubmitButton pending={pending}>치료 중단 기록</SubmitButton>
    </form>
  );
}
