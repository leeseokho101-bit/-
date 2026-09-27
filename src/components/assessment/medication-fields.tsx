"use client";

import { useState } from "react";
import { inputClass } from "@/components/form/field";
import { useFieldState, useFormValues } from "@/components/form/step-form";
import {
  DAILY_TABLETS_RANGE,
  productOptionGroups,
} from "@/domain/medication/catalog";

type Row = {
  key: number;
  name?: string;
  purpose?: string;
  frequency?: string;
  drugCode?: string;
  dailyTablets?: string;
};

const optionGroups = productOptionGroups();
const FIELDS = [
  "name",
  "purpose",
  "frequency",
  "drugCode",
  "dailyTablets",
] as const;

const MAX_ROWS = 20;

function initialRows(values: Record<string, string>): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const row: Row = { key: i };
    for (const f of FIELDS) row[f] = values[`meds.${i}.${f}`];
    if (FIELDS.every((f) => row[f] === undefined)) break;
    rows.push(row);
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
              <DoseFields row={row} index={i} />
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

/** 혈압약·당뇨약·고지혈증약: 성분·함량 + 하루 복용 알 수 (생체나이 보정용) */
function DoseFields({ row, index }: { row: Row; index: number }) {
  const [drugCode, setDrugCode] = useState(row.drugCode ?? "");
  const codeName = `meds.${index}.drugCode`;
  const tabletsName = `meds.${index}.dailyTablets`;
  const codeId = `med-${row.key}-drugCode`;
  const tabletsId = `med-${row.key}-dailyTablets`;
  return (
    <div className="bg-background flex flex-col gap-3 rounded-xl p-3">
      <p className="text-muted text-xs leading-relaxed">
        혈압약·당뇨약·고지혈증약이라면 성분과 1정당 함량을 골라 주세요. 복합제는
        성분별로 나눠 계산합니다. 모르면 비워 두셔도 돼요.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={codeId} className="text-sm font-medium">
          성분·함량 (선택)
        </label>
        <select
          id={codeId}
          name={codeName}
          value={drugCode}
          onChange={(e) => setDrugCode(e.target.value)}
          className={inputClass}
        >
          <option value="">해당 없음 / 모름</option>
          {optionGroups.map((g) => (
            <optgroup key={g.therapy} label={g.label}>
              {g.products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <RowError name={codeName} />
      </div>
      {drugCode && (
        <div className="flex flex-col gap-1">
          <label htmlFor={tabletsId} className="text-sm font-medium">
            하루 복용 알 수
          </label>
          <div className="flex items-center gap-2">
            <input
              id={tabletsId}
              name={tabletsName}
              type="text"
              inputMode="decimal"
              defaultValue={row.dailyTablets ?? "1"}
              placeholder="예: 1, 0.5, 2"
              className={inputClass}
              autoComplete="off"
              aria-describedby={`${tabletsId}-help`}
            />
            <span className="text-muted shrink-0 text-sm">알</span>
          </div>
          <p id={`${tabletsId}-help`} className="text-muted text-xs">
            하루에 먹는 전체 알 수예요. 반 알은 0.5로 적어 주세요. (
            {DAILY_TABLETS_RANGE.min}~{DAILY_TABLETS_RANGE.max}알)
          </p>
          <RowError name={tabletsName} />
        </div>
      )}
    </div>
  );
}
