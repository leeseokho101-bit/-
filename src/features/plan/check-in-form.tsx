"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/form/field";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import type { PlanCheck } from "@/domain/plan/builder";
import { saveCheckIn } from "./actions";

export function CheckInForm({
  weekNumber,
  checks,
  completed,
  weight,
}: {
  weekNumber: number;
  checks: PlanCheck[];
  completed: Record<string, boolean> | null;
  weight: number | null;
}) {
  const [state, action] = useActionState(saveCheckIn, {});
  const weightId = `weight-${weekNumber}`;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="weekNumber" value={weekNumber} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">이번 주 체크</legend>
        {checks.map((c) => (
          <label
            key={c.id}
            className="border-border bg-background has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5"
          >
            <input
              type="checkbox"
              name={`check.${c.id}`}
              defaultChecked={completed?.[c.id] ?? false}
              className="accent-primary mt-0.5 size-5 shrink-0"
            />
            <span className="text-[0.95rem] leading-relaxed">{c.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={weightId} className="font-semibold">
          이번 주 체중{" "}
          <span className="text-muted text-sm font-normal">(선택)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id={weightId}
            name="weight"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={weight ?? ""}
            placeholder="예: 72.5"
            className={inputClass}
          />
          <span className="text-muted min-w-12 text-sm">kg</span>
        </div>
      </div>
      <FormMessage message={state.message} />
      {state.notice && (
        <p
          role="status"
          className="bg-primary/5 border-primary/20 rounded-xl border px-4 py-3 text-sm leading-relaxed"
        >
          ✓ {state.notice}
        </p>
      )}
      <SubmitButton pendingText="저장 중…">체크 저장하기</SubmitButton>
    </form>
  );
}
