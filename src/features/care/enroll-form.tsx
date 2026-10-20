"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { inputClass } from "@/components/form/field";
import { careConsentItems } from "@/content/care";
import { DRUGS, formatDose, getDrug } from "@/domain/glp1/drugs";
import { routes } from "@/lib/routes";
import { enrollAction } from "./actions";
import {
  FieldError,
  FormFeedback,
  SubmitButton,
  submitWith,
} from "./form-bits";

export type EnrollDefaults = {
  clinicCode?: string;
  drugCode?: string;
  doseMg?: string;
  startDate?: string;
  shareWithClinic?: boolean;
  allowResearch?: boolean;
  allowPharmaStats?: boolean;
  consentService?: boolean;
};

/**
 * 프로그램 등록·설정. 의원의 등록 QR 카드는 연결 코드를 주소의 # 뒤(#code=...)에 담아
 * 서버로 보내지 않고 이 화면에서만 읽는다.
 */
export function EnrollForm({
  defaults,
  today,
  submitLabel,
}: {
  defaults: EnrollDefaults;
  today: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(enrollAction, {});
  const v = state.values ?? {};
  const [drugCode, setDrugCode] = useState(
    v.drugCode ?? defaults.drugCode ?? "",
  );
  const [clinicCode, setClinicCode] = useState(
    v.clinicCode ?? defaults.clinicCode ?? "",
  );
  const errors = state.fieldErrors ?? {};
  const drug = getDrug(drugCode);

  useEffect(() => {
    const m = /code=([A-Za-z0-9-]{4,20})/.exec(window.location.hash);
    // 외부 값(주소)과 맞추는 1회성 동기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m) setClinicCode(m[1].toUpperCase());
  }, []);

  const checkedDefault = (name: string) =>
    state.values
      ? state.values[name] === "on"
      : !!defaults[name as keyof EnrollDefaults];

  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clinicCode" className="font-semibold">
          의원 연결 코드{" "}
          <span className="text-muted text-sm font-normal">(선택)</span>
        </label>
        <p id="clinicCode-help" className="text-muted text-sm leading-relaxed">
          처방받은 의원에서 받은 등록 카드의 코드예요. QR로 들어왔다면 자동으로
          채워져요. 없으면 비워 두고 나중에 연결할 수 있어요.
        </p>
        <input
          id="clinicCode"
          name="clinicCode"
          value={clinicCode}
          onChange={(e) => setClinicCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="예: ABCD-1234"
          className={inputClass}
          aria-invalid={errors.clinicCode ? true : undefined}
          aria-describedby="clinicCode-help"
        />
        <FieldError message={errors.clinicCode} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="drugCode" className="font-semibold">
          처방받은 약
        </label>
        <select
          id="drugCode"
          name="drugCode"
          value={drugCode}
          onChange={(e) => setDrugCode(e.target.value)}
          className={inputClass}
          aria-invalid={errors.drugCode ? true : undefined}
        >
          <option value="">선택해 주세요</option>
          {DRUGS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.ingredient} · {d.product} (
              {d.intervalDays === 7 ? "주 1회" : "매일"})
            </option>
          ))}
        </select>
        <FieldError message={errors.drugCode} />
      </div>

      {drug && (
        <div className="flex flex-col gap-1.5" key={drug.code}>
          <label htmlFor="doseMg" className="font-semibold">
            지금 처방받은 용량
          </label>
          {drug.doseSteps.length ? (
            <select
              id="doseMg"
              name="doseMg"
              defaultValue={v.doseMg ?? defaults.doseMg ?? ""}
              className={inputClass}
              aria-invalid={errors.doseMg ? true : undefined}
            >
              <option value="">선택해 주세요</option>
              {drug.doseSteps.map((s) => (
                <option key={s} value={s}>
                  {formatDose(s)}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                id="doseMg"
                name="doseMg"
                inputMode="decimal"
                defaultValue={v.doseMg ?? defaults.doseMg ?? ""}
                className={inputClass}
                aria-invalid={errors.doseMg ? true : undefined}
              />
              <span className="text-muted text-sm">mg</span>
            </div>
          )}
          <p className="text-muted text-sm">
            처방전이나 약 포장에 적힌 용량을 골라 주세요. 용량은 담당 의사가
            정해요.
          </p>
          <FieldError message={errors.doseMg} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="startDate" className="font-semibold">
          첫 투약일
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={v.startDate ?? defaults.startDate ?? today}
          className={inputClass}
          aria-invalid={errors.startDate ? true : undefined}
        />
        <p className="text-muted text-sm">
          아직 시작 전이면 시작할 날을 골라 주세요.
        </p>
        <FieldError message={errors.startDate} />
      </div>

      <fieldset className="border-border flex flex-col gap-3 rounded-2xl border p-4">
        <legend className="px-1 font-semibold">개인정보·건강정보 동의</legend>
        {careConsentItems.map((c) => (
          <label key={c.name} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name={c.name}
              defaultChecked={checkedDefault(c.name)}
              className="accent-primary mt-1 size-5 shrink-0"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{c.title}</span>
              <span className="text-muted text-sm leading-relaxed">
                {c.body}
              </span>
            </span>
          </label>
        ))}
        <FieldError message={errors.consentService} />
        <p className="text-muted text-xs leading-relaxed">
          선택 항목은 동의하지 않아도 모든 기능을 쓸 수 있고, 설정에서 언제든
          바꿀 수 있어요. 자세한 내용:{" "}
          <Link href={routes.about} className="underline">
            서비스 소개
          </Link>
        </p>
      </fieldset>

      <FormFeedback state={state} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
