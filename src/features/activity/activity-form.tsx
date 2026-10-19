"use client";

import { startTransition, useActionState, useState } from "react";
import { inputClass } from "@/components/form/field";
import { FormMessage } from "@/components/form/form-message";
import { buttonBase } from "@/components/ui/button-link";
import { exerciseTypeLabels, intensityLabels } from "@/content/activity";
import {
  EXERCISE_TYPES,
  INTENSITIES,
  type DailyActivity,
} from "@/domain/bio-age/activity";
import { saveActivityAction } from "./actions";
import { MAX_SESSIONS } from "./schemas";

type Row = { key: number; type: string; intensity: string; minutes: string };

function rowsOf(log: DailyActivity | undefined): Row[] {
  const rows = (log?.sessions ?? []).map((s, i) => ({
    key: i,
    type: s.type,
    intensity: s.intensity,
    minutes: String(s.minutes),
  }));
  return rows.length
    ? rows
    : [{ key: 0, type: "", intensity: "", minutes: "" }];
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-700">⚠ {message}</p>
  ) : null;
}

/**
 * 하루 활동 기록 폼. 날짜를 바꾸면 그날 저장된 기록을 불러와 고칠 수 있다.
 * 걸음수와 운동을 모두 비우고 저장하면 그날 기록이 지워진다.
 */
export function ActivityForm({
  today,
  earliest,
  logs,
}: {
  today: string;
  earliest: string;
  /** 고칠 수 있는 기간의 저장된 기록 */
  logs: DailyActivity[];
}) {
  const [state, action, pending] = useActionState(saveActivityAction, {});
  const [date, setDate] = useState(state.values?.date ?? today);
  const log = logs.find((l) => l.date === date);
  return (
    // 날짜가 바뀌면 그날 기록으로 다시 그린다
    <DayForm
      key={date}
      date={date}
      onDateChange={setDate}
      today={today}
      earliest={earliest}
      log={log}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

function DayForm({
  date,
  onDateChange,
  today,
  earliest,
  log,
  state,
  action,
  pending,
}: {
  date: string;
  onDateChange: (d: string) => void;
  today: string;
  earliest: string;
  log: DailyActivity | undefined;
  state: Awaited<ReturnType<typeof saveActivityAction>>;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => rowsOf(log));
  const nextKey = Math.max(...rows.map((r) => r.key)) + 1;
  const errors = state.fieldErrors ?? {};
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form
      // action 속성 대신 직접 제출: React의 제출 후 폼 초기화가 선택 상자(제어 컴포넌트)
      // 화면 값을 지워 실제 값과 어긋나는 것을 막는다
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="activity-date" className="font-semibold">
          날짜
        </label>
        <input
          id="activity-date"
          name="date"
          type="date"
          min={earliest}
          max={today}
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          className={inputClass}
        />
        <p className="text-muted text-sm">
          {log
            ? "이 날 저장한 기록을 고칠 수 있어요."
            : "지난 7일까지 기록할 수 있어요."}
        </p>
        <FieldError message={errors.date} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="activity-steps" className="font-semibold">
          걸음수 <span className="text-muted text-sm font-normal">(선택)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="activity-steps"
            name="steps"
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 7500"
            defaultValue={state.values?.steps ?? log?.steps ?? ""}
            className={inputClass}
            aria-describedby="activity-steps-help"
          />
          <span className="text-muted min-w-8 text-sm">보</span>
        </div>
        <p id="activity-steps-help" className="text-muted text-sm">
          휴대폰 건강 앱의 하루 걸음수를 적어 주세요. 걷기는 걸음수로 반영돼요.
        </p>
        <FieldError message={errors.steps} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">
          운동{" "}
          <span className="text-muted text-sm font-normal">
            (선택, 최대 {MAX_SESSIONS}개)
          </span>
        </legend>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="border-border bg-background flex flex-col gap-2 rounded-xl border p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">운동 {i + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) => rs.filter((x) => x.key !== r.key))
                  }
                  className="text-muted text-sm underline"
                >
                  삭제
                </button>
              )}
            </div>
            <label className="sr-only" htmlFor={`type-${r.key}`}>
              운동 {i + 1} 종류
            </label>
            <select
              id={`type-${r.key}`}
              name={`sessions.${i}.type`}
              value={r.type}
              onChange={(e) => update(r.key, { type: e.target.value })}
              className={inputClass}
            >
              <option value="">운동 종류 선택</option>
              {EXERCISE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {exerciseTypeLabels[t]}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <div>
                <label className="sr-only" htmlFor={`intensity-${r.key}`}>
                  운동 {i + 1} 강도
                </label>
                <select
                  id={`intensity-${r.key}`}
                  name={`sessions.${i}.intensity`}
                  value={r.intensity}
                  onChange={(e) => update(r.key, { intensity: e.target.value })}
                  className={inputClass}
                >
                  <option value="">강도 선택</option>
                  {INTENSITIES.map((k) => (
                    <option key={k} value={k}>
                      {intensityLabels[k].label} — {intensityLabels[k].help}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="sr-only" htmlFor={`minutes-${r.key}`}>
                  운동 {i + 1} 시간(분)
                </label>
                <input
                  id={`minutes-${r.key}`}
                  name={`sessions.${i}.minutes`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="30"
                  value={r.minutes}
                  onChange={(e) => update(r.key, { minutes: e.target.value })}
                  className={inputClass}
                />
                <span className="text-muted text-sm">분</span>
              </div>
            </div>
            <FieldError
              message={
                errors[`sessions.${i}.type`] ??
                errors[`sessions.${i}.intensity`] ??
                errors[`sessions.${i}.minutes`]
              }
            />
          </div>
        ))}
        {rows.length < MAX_SESSIONS && (
          <button
            type="button"
            onClick={() =>
              setRows((rs) => [
                ...rs,
                { key: nextKey, type: "", intensity: "", minutes: "" },
              ])
            }
            className="text-primary border-primary/40 min-h-12 rounded-xl border border-dashed text-sm font-semibold"
          >
            + 운동 추가
          </button>
        )}
        <p className="text-muted text-sm leading-relaxed">
          강도는 운동하면서 말할 수 있는 정도로 골라 주세요. 힘든 운동 1분은
          중간 강도 2분으로 계산해요.
        </p>
      </fieldset>

      <FormMessage message={state.message} />
      {state.notice && (
        <p
          role="status"
          className="bg-primary/5 border-primary/20 rounded-xl border px-4 py-3 text-sm leading-relaxed"
        >
          ✓ {state.notice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90 w-full disabled:opacity-60`}
      >
        {pending ? "저장 중…" : "기록 저장하기"}
      </button>
    </form>
  );
}
