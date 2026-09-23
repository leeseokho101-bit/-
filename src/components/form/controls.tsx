"use client";

import { useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Field, inputClass } from "./field";
import { useFieldState } from "./step-form";

function idOf(name: string) {
  return `f-${name.replace(/\./g, "-")}`;
}

function describedBy(id: string, help?: ReactNode, error?: string) {
  return (
    [help ? `${id}-help` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

type BaseProps = {
  name: string;
  label: string;
  help?: ReactNode;
  optional?: boolean;
};

/** 입력 필드 (숫자·텍스트·날짜·시간) */
export function InputField({
  name,
  label,
  help,
  optional,
  unit,
  ...props
}: BaseProps & { unit?: string } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "name"
  >) {
  const { defaultValue, error } = useFieldState(name);
  const id = idOf(name);
  return (
    <Field
      id={id}
      label={label}
      help={help}
      error={error}
      unit={unit}
      optional={optional}
    >
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...props}
      />
    </Field>
  );
}

export function NumberField(
  props: BaseProps & {
    unit?: string;
    decimals?: number;
    placeholder?: string;
    required?: boolean;
  },
) {
  const { decimals = 0, ...rest } = props;
  return (
    <InputField
      {...rest}
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
    />
  );
}

/** 큰 버튼형 단일 선택 (라디오). 선택 해제 가능 */
export function ChoiceField({
  name,
  label,
  help,
  optional = true,
  options,
  columns = 2,
}: BaseProps & {
  options: readonly { value: string; label: string }[];
  columns?: 1 | 2 | 3;
}) {
  const { defaultValue, error } = useFieldState(name);
  const ref = useRef<HTMLFieldSetElement>(null);
  const id = idOf(name);
  const grid = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" }[
    columns
  ];
  return (
    <fieldset
      ref={ref}
      className="flex flex-col gap-2"
      aria-describedby={describedBy(id, help, error)}
    >
      <legend className="mb-1.5 font-semibold">
        {label}
        {optional && (
          <span className="text-muted ml-1 text-sm font-normal">(선택)</span>
        )}
      </legend>
      {help && (
        <p
          id={`${id}-help`}
          className="text-muted -mt-1 text-sm leading-relaxed"
        >
          {help}
        </p>
      )}
      <div className={`grid ${grid} gap-2`}>
        {options.map((o) => (
          <label
            key={o.value}
            className="group border-border bg-surface has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary has-[:focus-visible]:outline-primary flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-[0.95rem] has-[:checked]:font-semibold has-[:focus-visible]:outline-2"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="sr-only"
            />
            <span aria-hidden className="hidden group-has-[:checked]:inline">
              ✓
            </span>
            {o.label}
          </label>
        ))}
      </div>
      {optional && (
        <button
          type="button"
          className="text-muted self-start text-sm underline"
          onClick={() =>
            ref.current
              ?.querySelectorAll<HTMLInputElement>("input[type=radio]")
              .forEach((r) => (r.checked = false))
          }
        >
          선택 지우기
        </button>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="text-sm font-medium text-red-700"
          role="alert"
        >
          ⚠ {error}
        </p>
      )}
    </fieldset>
  );
}

/** 여러 입력을 묶는 카드 섹션 */
export function FormSection({
  title,
  description,
  children,
  collapsible = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
}) {
  const body = (
    <div className="flex flex-col gap-5">
      {description && (
        <p className="text-muted text-sm leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  );
  if (collapsible) {
    return (
      <details
        open
        className="border-border bg-surface group rounded-2xl border p-5 shadow-sm"
      >
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-lg font-bold">
          {title}
          <span
            aria-hidden
            className="text-muted text-sm group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <div className="mt-4">{body}</div>
      </details>
    );
  }
  return (
    <section className="border-border bg-surface flex flex-col gap-4 rounded-2xl border p-5 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      {body}
    </section>
  );
}
