"use client";

import { useActionState, useState } from "react";
import { inputClass } from "@/components/form/field";
import { siteLabels, siteTip } from "@/content/care";
import { INJECTION_SITES, type InjectionSite } from "@/domain/glp1/dosing";
import { formatDose, type DrugInfo } from "@/domain/glp1/drugs";
import { saveDoseAction, updateCurrentDoseAction } from "./actions";
import {
  ChoiceCards,
  FieldError,
  FormFeedback,
  SubmitButton,
  submitWith,
} from "./form-bits";

/** 투약 기록 (투약함 / 놓침). 주사 부위는 가장 오래 쉰 부위를 미리 골라 둔다 */
export function DoseForm({
  drug,
  doseMg,
  suggestedSite,
  today,
  earliest,
  nowTime,
}: {
  drug: DrugInfo;
  doseMg: number;
  suggestedSite: InjectionSite;
  today: string;
  earliest: string;
  nowTime: string;
}) {
  const [state, action, pending] = useActionState(saveDoseAction, {});
  const v = state.values ?? {};
  const [status, setStatus] = useState(v.status ?? "TAKEN");
  const errors = state.fieldErrors ?? {};
  const injection = drug.route === "INJECTION";
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-4"
      noValidate
    >
      <ChoiceCards
        name="status"
        legend="투약했나요?"
        value={status}
        onChange={setStatus}
        options={[
          {
            value: "TAKEN",
            label: injection ? "💉 주사했어요" : "💊 먹었어요",
          },
          { value: "MISSED", label: "놓쳤어요" },
        ]}
        error={errors.status}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dose-date" className="font-semibold">
            날짜
          </label>
          <input
            id="dose-date"
            name="date"
            type="date"
            min={earliest}
            max={today}
            defaultValue={v.date ?? today}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dose-time" className="font-semibold">
            시각
          </label>
          <input
            id="dose-time"
            name="time"
            type="time"
            defaultValue={v.time ?? nowTime}
            className={inputClass}
          />
        </div>
      </div>
      <FieldError message={errors.date ?? errors.time} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dose-mg" className="font-semibold">
          용량
        </label>
        {drug.doseSteps.length ? (
          <select
            id="dose-mg"
            name="doseMg"
            defaultValue={v.doseMg ?? String(doseMg)}
            className={inputClass}
          >
            {drug.doseSteps.map((s) => (
              <option key={s} value={s}>
                {formatDose(s)}
                {s === doseMg ? " (현재 처방)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <input
              id="dose-mg"
              name="doseMg"
              inputMode="decimal"
              defaultValue={v.doseMg ?? String(doseMg)}
              className={inputClass}
            />
            <span className="text-muted text-sm">mg</span>
          </div>
        )}
        <FieldError message={errors.doseMg} />
      </div>
      {injection && status === "TAKEN" && (
        <ChoiceCards
          name="site"
          legend="주사 부위"
          help={`이번에는 ${siteLabels[suggestedSite]}를 추천해요. ${siteTip}`}
          defaultValue={v.site ?? suggestedSite}
          options={INJECTION_SITES.map((s) => ({
            value: s,
            label: (
              <>
                {siteLabels[s]}
                {s === suggestedSite && (
                  <span className="sr-only"> (추천)</span>
                )}
                {s === suggestedSite && (
                  <span aria-hidden className="ml-1 text-xs">
                    ★
                  </span>
                )}
              </>
            ),
          }))}
          error={errors.site}
        />
      )}
      <FormFeedback state={state} />
      <SubmitButton pending={pending}>기록하기</SubmitButton>
    </form>
  );
}

/** 담당 의사가 용량을 바꿨을 때 */
export function CurrentDoseForm({
  drug,
  doseMg,
  today,
}: {
  drug: DrugInfo;
  doseMg: number;
  today: string;
}) {
  const [state, action, pending] = useActionState(updateCurrentDoseAction, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-3"
      noValidate
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current-dose" className="text-sm font-semibold">
            새 처방 용량
          </label>
          {drug.doseSteps.length ? (
            <select
              id="current-dose"
              name="doseMg"
              defaultValue={String(doseMg)}
              className={inputClass}
            >
              {drug.doseSteps.map((s) => (
                <option key={s} value={s}>
                  {formatDose(s)}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="current-dose"
              name="doseMg"
              inputMode="decimal"
              defaultValue={String(doseMg)}
              className={inputClass}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dose-since" className="text-sm font-semibold">
            바뀐 날
          </label>
          <input
            id="dose-since"
            name="doseSince"
            type="date"
            defaultValue={today}
            className={inputClass}
          />
        </div>
      </div>
      <FieldError message={errors.doseMg ?? errors.doseSince} />
      <FormFeedback state={state} />
      <SubmitButton pending={pending}>처방 용량 바꾸기</SubmitButton>
    </form>
  );
}
