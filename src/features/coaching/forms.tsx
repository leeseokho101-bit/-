"use client";

import { useActionState, useState } from "react";
import { inputClass } from "@/components/form/field";
import { referralReasonLabels } from "@/content/coaching";
import { MEDICATION_REPLY, MESSAGE_MAX_LENGTH } from "@/domain/coaching/scope";
import {
  FormFeedback,
  SubmitButton,
  submitWith,
} from "@/features/care/form-bits";
import type { FormState } from "@/lib/form-state";
import {
  referToClinicAction,
  sendCoachMessageAction,
  sendPatientMessageAction,
} from "./actions";

const REFERRAL_REASONS = [
  "MEDICATION_QUESTION",
  "PERSISTENT_SYMPTOM",
  "LOW_GLUCOSE",
  "OTHER",
] as const;

/** 보내고 나면 입력창을 비운다 (상태가 바뀐 렌더에서 맞춰 줌) */
function useComposer(state: FormState) {
  const [body, setBody] = useState("");
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.notice) setBody("");
    else if (state.values?.body !== undefined) setBody(state.values.body);
  }
  return [body, setBody] as const;
}

function Composer({
  id,
  label,
  body,
  setBody,
  rows = 3,
}: {
  id: string;
  label: string;
  body: string;
  setBody: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name="body"
        rows={rows}
        maxLength={MESSAGE_MAX_LENGTH}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={`${inputClass} py-3 leading-relaxed`}
      />
      <p className="text-muted text-right text-xs">
        {body.length.toLocaleString()} / {MESSAGE_MAX_LENGTH.toLocaleString()}
      </p>
    </div>
  );
}

export function PatientMessageForm() {
  const [state, action, pending] = useActionState(sendPatientMessageAction, {});
  const [body, setBody] = useComposer(state);
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-2"
      noValidate
    >
      <Composer
        id="patient-message"
        label="코치에게 메시지"
        body={body}
        setBody={setBody}
      />
      <FormFeedback state={state} />
      <SubmitButton pending={pending} pendingText="보내는 중…">
        보내기
      </SubmitButton>
    </form>
  );
}

export function CoachMessageForm({
  patientId,
  draft,
  hasMedicationQuestion,
}: {
  patientId: string;
  draft: string;
  hasMedicationQuestion: boolean;
}) {
  const [state, action, pending] = useActionState(sendCoachMessageAction, {});
  const [body, setBody] = useComposer(state);
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-2"
      noValidate
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBody(draft)}
          className="border-primary/40 text-primary min-h-10 rounded-full border px-3 text-sm font-semibold"
        >
          주간 피드백 초안 넣기
        </button>
        {hasMedicationQuestion && (
          <button
            type="button"
            onClick={() => setBody(MEDICATION_REPLY)}
            className="min-h-10 rounded-full border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900"
          >
            약 문의 답장 넣기
          </button>
        )}
      </div>
      <Composer
        id="coach-message"
        label="답장"
        body={body}
        setBody={setBody}
        rows={6}
      />
      <FormFeedback state={state} />
      <SubmitButton pending={pending} pendingText="보내는 중…">
        보내기
      </SubmitButton>
    </form>
  );
}

export function ReferralForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(referToClinicAction, {});
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-3"
      noValidate
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="referral-reason" className="text-sm font-semibold">
          사유
        </label>
        <select
          id="referral-reason"
          name="reason"
          defaultValue=""
          className={inputClass}
        >
          <option value="">골라 주세요</option>
          {REFERRAL_REASONS.map((r) => (
            <option key={r} value={r}>
              {referralReasonLabels[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="referral-note" className="text-sm font-semibold">
          메모{" "}
          <span className="text-muted font-normal">
            (선택, 150자 · 의원에 보여요)
          </span>
        </label>
        <input
          id="referral-note"
          name="note"
          maxLength={150}
          autoComplete="off"
          className={inputClass}
        />
      </div>
      <FormFeedback state={state} />
      <SubmitButton pending={pending}>담당 의원에 확인 요청</SubmitButton>
    </form>
  );
}
