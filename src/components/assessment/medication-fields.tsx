"use client";

import { useState } from "react";
import { inputClass } from "@/components/form/field";
import { useFieldState, useFormValues } from "@/components/form/step-form";

type Row = { key: number; name?: string; purpose?: string; frequency?: string };

const MAX_ROWS = 20;

function initialRows(values: Record<string, string>): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const name = values[`meds.${i}.name`];
    const purpose = values[`meds.${i}.purpose`];
    const frequency = values[`meds.${i}.frequency`];
    if (name === undefined && purpose === undefined && frequency === undefined)
      break;
    rows.push({ key: i, name, purpose, frequency });
  }
  return rows.length ? rows : [{ key: 0 }];
}

function RowError({ name }: { name: string }) {
  const { error } = useFieldState(name);
  return error ? (
    <p className="text-sm font-medium text-red-700">⚠ {error}</p>
  ) : null;
}

export function MedicationFields() {
  const values = useFormValues();
  const [none, setNone] = useState(values.none === "yes");
  const [rows, setRows] = useState<Row[]>(() => initialRows(values));
  const nextKey = Math.max(...rows.map((r) => r.key)) + 1;

  return (
    <div className="flex flex-col gap-4">
      <label className="border-border bg-surface flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4">
        <input
          type="checkbox"
          name="none"
          value="yes"
          checked={none}
          onChange={(e) => setNone(e.target.checked)}
          className="accent-primary size-5"
        />
        <span className="font-medium">현재 복용 중인 약이 없어요</span>
      </label>

      {!none && (
        <>
          {rows.map((row, i) => (
            <fieldset
              key={row.key}
              className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-4"
            >
              <legend className="sr-only">복용약 {i + 1}</legend>
              <div className="flex items-center justify-between">
                <span className="font-semibold">약 {i + 1}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="text-muted text-sm underline"
                    onClick={() =>
                      setRows(rows.filter((r) => r.key !== row.key))
                    }
                  >
                    삭제
                  </button>
                )}
              </div>
              {(
                [
                  [
                    "name",
                    "약 이름",
                    "예: 처방받은 약 이름 또는 영양제 이름",
                    50,
                  ],
                  [
                    "purpose",
                    "복용 목적 (선택)",
                    "예: 혈압, 콜레스테롤, 영양제",
                    50,
                  ],
                  ["frequency", "복용 빈도 (선택)", "예: 하루 1회 아침", 30],
                ] as const
              ).map(([field, label, placeholder, max]) => {
                const name = `meds.${i}.${field}`;
                const id = `med-${row.key}-${field}`;
                return (
                  <div key={field} className="flex flex-col gap-1">
                    <label htmlFor={id} className="text-sm font-medium">
                      {label}
                    </label>
                    <input
                      id={id}
                      name={name}
                      defaultValue={row[field]}
                      placeholder={placeholder}
                      maxLength={max}
                      className={inputClass}
                      autoComplete="off"
                    />
                    <RowError name={name} />
                  </div>
                );
              })}
            </fieldset>
          ))}
          {rows.length < MAX_ROWS && (
            <button
              type="button"
              onClick={() => setRows([...rows, { key: nextKey }])}
              className="border-primary/40 text-primary min-h-12 rounded-xl border-2 border-dashed font-semibold"
            >
              + 약 추가하기
            </button>
          )}
        </>
      )}
    </div>
  );
}
