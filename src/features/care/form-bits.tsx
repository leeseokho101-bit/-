"use client";

import { startTransition, type FormEvent, type ReactNode } from "react";
import { FormMessage } from "@/components/form/form-message";
import { buttonBase } from "@/components/ui/button-link";

export function FieldError({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm font-medium text-red-700">
      ⚠ {message}
    </p>
  ) : null;
}

export function Notice({ text }: { text?: string }) {
  return text ? (
    <p
      role="status"
      className="bg-primary/5 border-primary/20 rounded-xl border px-4 py-3 text-sm leading-relaxed"
    >
      ✓ {text}
    </p>
  ) : null;
}

export function FormFeedback({
  state,
}: {
  state: { message?: string; notice?: string };
}) {
  return (
    <>
      <FormMessage message={state.message} />
      <Notice text={state.notice} />
    </>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingText = "저장 중…",
}: {
  pending: boolean;
  children: ReactNode;
  pendingText?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90 w-full disabled:opacity-60`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * action 속성 대신 직접 제출: React의 제출 후 폼 초기화가 화면 값을 지워
 * 실제 저장 값과 어긋나는 것을 막는다 (activity-form과 같은 방식)
 */
export function submitWith(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

/** 큰 버튼형 선택지 (라디오) */
export function ChoiceCards({
  name,
  legend,
  options,
  value,
  defaultValue,
  onChange,
  columns = 2,
  error,
  help,
}: {
  name: string;
  legend: ReactNode;
  options: readonly { value: string; label: ReactNode }[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  columns?: 2 | 3 | 4;
  error?: string;
  help?: ReactNode;
}) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[
    columns
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 font-semibold">{legend}</legend>
      {help && (
        <p className="text-muted -mt-1 text-sm leading-relaxed">{help}</p>
      )}
      <div className={`grid ${grid} gap-2`}>
        {options.map((o) => (
          <label
            key={o.value}
            className="border-border bg-surface has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary has-[:focus-visible]:outline-primary flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-center text-[0.95rem] has-[:checked]:font-semibold has-[:focus-visible]:outline-2"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              {...(value !== undefined
                ? {
                    checked: value === o.value,
                    onChange: () => onChange?.(o.value),
                  }
                : { defaultChecked: defaultValue === o.value })}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}
