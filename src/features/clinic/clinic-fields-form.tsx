"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/form/field";
import {
  FieldError,
  FormFeedback,
  SubmitButton,
  submitWith,
} from "@/features/care/form-bits";
import { updateClinicFieldsAction } from "./actions";

/** 다음 내원일·차트번호 (의원이 입력) */
export function ClinicFieldsForm({
  patientId,
  nextVisitOn,
  chartNo,
  today,
}: {
  patientId: string;
  nextVisitOn: string | null;
  chartNo: string | null;
  today: string;
}) {
  const [state, action, pending] = useActionState(updateClinicFieldsAction, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-3"
      noValidate
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nextVisitOn" className="text-sm font-semibold">
            다음 내원 예정일
          </label>
          <input
            id="nextVisitOn"
            name="nextVisitOn"
            type="date"
            min={today}
            defaultValue={state.values?.nextVisitOn ?? nextVisitOn ?? ""}
            className={inputClass}
          />
          <FieldError message={errors.nextVisitOn} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="chartNo" className="text-sm font-semibold">
            차트번호
          </label>
          <input
            id="chartNo"
            name="chartNo"
            autoComplete="off"
            defaultValue={state.values?.chartNo ?? chartNo ?? ""}
            className={inputClass}
          />
          <FieldError message={errors.chartNo} />
        </div>
      </div>
      <FormFeedback state={state} />
      <SubmitButton pending={pending}>저장</SubmitButton>
    </form>
  );
}
