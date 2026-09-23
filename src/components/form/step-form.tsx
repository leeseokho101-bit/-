"use client";

import {
  createContext,
  useActionState,
  useContext,
  type ReactNode,
} from "react";
import { ButtonLink } from "@/components/ui/button-link";
import type { FormState } from "@/lib/form-state";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

type FormCtx = {
  values: Record<string, string>;
  errors: Record<string, string>;
};
const StepFormContext = createContext<FormCtx>({ values: {}, errors: {} });

export function useFormValues() {
  return useContext(StepFormContext).values;
}

export function useFieldState(name: string) {
  const { values, errors } = useContext(StepFormContext);
  return { defaultValue: values[name], error: errors[name] };
}

/** 입력 단계 폼: 저장(Server Action) 후 다음 단계로 이동 */
export function StepForm({
  action,
  defaults,
  prevHref,
  submitLabel = "저장하고 다음",
  children,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: Record<string, string>;
  prevHref: string;
  submitLabel?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  const ctx: FormCtx = {
    values: state.values ?? defaults,
    errors: state.fieldErrors ?? {},
  };
  return (
    <StepFormContext.Provider value={ctx}>
      <form
        action={formAction}
        className="flex flex-1 flex-col gap-5"
        noValidate
      >
        <FormMessage message={state.message} />
        {children}
        <div className="mt-auto grid grid-cols-[1fr_2fr] gap-3 pt-4">
          <ButtonLink href={prevHref} variant="secondary">
            이전
          </ButtonLink>
          <SubmitButton pendingText="저장 중…">{submitLabel}</SubmitButton>
        </div>
      </form>
    </StepFormContext.Provider>
  );
}
