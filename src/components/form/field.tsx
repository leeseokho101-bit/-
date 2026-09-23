import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-2 focus:outline-primary/30 aria-[invalid=true]:border-red-600";

/** 라벨 · 도움말 · 오류 메시지를 갖춘 입력 필드 */
export function Field({
  id,
  label,
  help,
  error,
  unit,
  optional,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  error?: string;
  unit?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
        {optional && (
          <span className="text-muted ml-1 text-sm font-normal">(선택)</span>
        )}
      </label>
      {help && (
        <p id={`${id}-help`} className="text-muted text-sm leading-relaxed">
          {help}
        </p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1">{children}</div>
        {unit && <span className="text-muted min-w-12 text-sm">{unit}</span>}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="text-sm font-medium text-red-700"
          role="alert"
        >
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  id,
  error,
  help,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  error?: string;
  help?: boolean;
}) {
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <input
      id={id}
      name={props.name ?? id}
      className={inputClass}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
      {...props}
    />
  );
}
