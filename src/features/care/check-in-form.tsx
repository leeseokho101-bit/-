"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/form/field";
import { redFlagLabels, severityLabels, symptomLabels } from "@/content/care";
import {
  RED_FLAGS,
  SEVERITIES,
  SYMPTOMS,
  type RedFlagCode,
  type SymptomScores,
} from "@/domain/glp1/symptoms";
import { saveCheckInAction } from "./actions";
import {
  ChoiceCards,
  FieldError,
  FormFeedback,
  SubmitButton,
  submitWith,
} from "./form-bits";

export type CheckInDefaults = {
  symptoms: SymptomScores;
  redFlags: RedFlagCode[];
  appetite: number | null;
  weightKg: number | null;
};

/** 하루 1분 체크인: 증상 6가지 정도 + 위험 신호 + 식욕 + 체중(선택) */
export function CheckInForm({
  date,
  defaults,
}: {
  date: string;
  defaults: CheckInDefaults | null;
}) {
  const [state, action, pending] = useActionState(saveCheckInAction, {});
  const v = state.values;
  const errors = state.fieldErrors ?? {};
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-5"
      noValidate
    >
      <input type="hidden" name="date" value={date} />
      {SYMPTOMS.map((code) => (
        <ChoiceCards
          key={code}
          name={`symptoms.${code}`}
          legend={symptomLabels[code]}
          columns={4}
          defaultValue={
            v?.[`symptoms.${code}`] ?? String(defaults?.symptoms[code] ?? 0)
          }
          options={SEVERITIES.map((s) => ({
            value: String(s),
            label: severityLabels[s],
          }))}
          error={errors[`symptoms.${code}`]}
        />
      ))}

      <fieldset className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
        <legend className="px-1 font-semibold">
          이런 일이 있었나요? (해당하면 체크)
        </legend>
        {RED_FLAGS.map((code) => (
          <label
            key={code}
            className="flex min-h-10 cursor-pointer items-start gap-3"
          >
            <input
              type="checkbox"
              name={`redFlag.${code}`}
              defaultChecked={
                v
                  ? v[`redFlag.${code}`] === "on"
                  : !!defaults?.redFlags.includes(code)
              }
              className="accent-primary mt-1 size-5 shrink-0"
            />
            <span className="leading-relaxed">{redFlagLabels[code]}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="appetite" className="font-semibold">
          오늘 식욕{" "}
          <span className="text-muted text-sm font-normal">
            (0 전혀 없음 ~ 10 평소보다 많음)
          </span>
        </label>
        <input
          id="appetite"
          name="appetite"
          type="range"
          min={0}
          max={10}
          step={1}
          list="appetite-ticks"
          defaultValue={v?.appetite ?? defaults?.appetite ?? 5}
          className="accent-primary h-10 w-full"
        />
        <datalist id="appetite-ticks">
          {Array.from({ length: 11 }, (_, i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <div aria-hidden className="text-muted flex justify-between text-xs">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
        <FieldError message={errors.appetite} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="weightKg" className="font-semibold">
          체중 <span className="text-muted text-sm font-normal">(선택)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="weightKg"
            name="weightKg"
            inputMode="decimal"
            autoComplete="off"
            placeholder="예: 82.5"
            defaultValue={v?.weightKg ?? defaults?.weightKg ?? ""}
            className={inputClass}
          />
          <span className="text-muted text-sm">kg</span>
        </div>
        <FieldError message={errors.weightKg} />
      </div>

      <FormFeedback state={state} />
      <SubmitButton pending={pending}>체크인 저장</SubmitButton>
    </form>
  );
}
