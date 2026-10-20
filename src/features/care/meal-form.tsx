"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { inputClass } from "@/components/form/field";
import { FormMessage } from "@/components/form/form-message";
import { buttonBase } from "@/components/ui/button-link";
import { mealTypeLabels } from "@/content/care";
import {
  MAX_MEAL_ITEMS,
  MEAL_TYPES,
  type MealItem,
  type MealType,
} from "@/domain/glp1/meal";
import { readMealPhotoAction, saveMealAction } from "./actions";
import {
  ChoiceCards,
  FieldError,
  FormFeedback,
  SubmitButton,
  submitWith,
} from "./form-bits";

type Row = {
  key: number;
  name: string;
  kcal: string;
  carbsG: string;
  proteinG: string;
};

const emptyRow = (key: number): Row => ({
  key,
  name: "",
  kcal: "",
  carbsG: "",
  proteinG: "",
});
const rowsOf = (items: MealItem[]): Row[] =>
  items.map((i, key) => ({
    key,
    name: i.name,
    kcal: i.kcal?.toString() ?? "",
    carbsG: i.carbsG?.toString() ?? "",
    proteinG: i.proteinG?.toString() ?? "",
  }));

/** 지금 시각 → 식사 종류 기본값 */
function mealTypeAt(time: string): MealType {
  const h = Number(time.slice(0, 2));
  if (h >= 5 && h < 10) return "BREAKFAST";
  if (h >= 11 && h < 15) return "LUNCH";
  if (h >= 17 && h < 21) return "DINNER";
  return "SNACK";
}

const MAX_EDGE = 1600;

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.8,
    ),
  );
}

/** 식사 사진 → 추정 (사진은 저장하지 않음). 결과는 아래 기록 폼에 채워진다 */
function MealPhoto({ onItems }: { onItems: (items: MealItem[]) => void }) {
  const [state, action, pending] = useActionState(readMealPhotoAction, {});
  const applied = useRef<string | null>(null);
  useEffect(() => {
    // 새 추정 결과가 올 때 한 번만 채운다 (이후 사용자가 고친 값을 덮어쓰지 않음)
    if (state.result && state.result.key !== applied.current) {
      applied.current = state.result.key;
      onItems(state.result.items);
    }
  }, [state.result, onItems]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("photo");
    if (file instanceof File && file.size > 0) {
      try {
        fd.set("photo", await shrinkImage(file), "meal.jpg");
      } catch {
        // 변환 못 하면 원본을 보내고 서버에서 형식·크기를 확인한다
      }
    }
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <label className="border-border bg-surface has-[:focus-visible]:outline-primary flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-3 text-center has-[:focus-visible]:outline-2">
        <span aria-hidden className="text-3xl">
          📷
        </span>
        <span className="font-semibold">식사 사진 찍기 · 선택하기</span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="sr-only"
        />
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="consentPhoto"
          className="accent-primary mt-0.5 size-5 shrink-0"
        />
        <span className="text-muted leading-relaxed">
          음식 추정을 위해 사진이 AI 서비스로 전송되는 데 동의해요. 사진은
          저장하지 않고, 추정값은 확인한 뒤 저장할 때만 기록돼요.
        </span>
      </label>
      <FormMessage message={state.message} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonBase} border-border bg-surface w-full border disabled:opacity-60`}
      >
        {pending ? "추정하는 중…" : "사진으로 음식 추정하기"}
      </button>
    </form>
  );
}

export function MealForm({
  today,
  earliest,
  nowTime,
  photoAvailable,
}: {
  today: string;
  earliest: string;
  nowTime: string;
  photoAvailable: boolean;
}) {
  const [state, action, pending] = useActionState(saveMealAction, {});
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [source, setSource] = useState<"MANUAL" | "PHOTO_AI">("MANUAL");
  const errors = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const nextKey = Math.max(...rows.map((r) => r.key)) + 1;
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-5">
      {photoAvailable && (
        <MealPhoto
          onItems={(items) => {
            setRows(rowsOf(items));
            setSource("PHOTO_AI");
          }}
        />
      )}
      <form
        onSubmit={submitWith(action)}
        className="flex flex-col gap-4"
        noValidate
      >
        <input type="hidden" name="source" value={source} />
        {source === "PHOTO_AI" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            사진으로 추정한 값이에요. 실제와 다를 수 있으니 확인하고 고쳐
            주세요.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meal-date" className="font-semibold">
              날짜
            </label>
            <input
              id="meal-date"
              name="date"
              type="date"
              min={earliest}
              max={today}
              defaultValue={v.date ?? today}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meal-time" className="font-semibold">
              먹은 시각
            </label>
            <input
              id="meal-time"
              name="time"
              type="time"
              defaultValue={v.time ?? nowTime}
              className={inputClass}
            />
          </div>
        </div>
        <FieldError message={errors.date ?? errors.time} />
        <ChoiceCards
          name="mealType"
          legend="식사"
          columns={4}
          defaultValue={v.mealType ?? mealTypeAt(nowTime)}
          options={MEAL_TYPES.map((t) => ({
            value: t,
            label: mealTypeLabels[t],
          }))}
          error={errors.mealType}
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold">
            먹은 음식{" "}
            <span className="text-muted text-sm font-normal">
              (영양값은 선택)
            </span>
          </legend>
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="border-border bg-background flex flex-col gap-2 rounded-xl border p-3"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`item-${r.key}`}
                  className="text-sm font-semibold"
                >
                  음식 {i + 1}
                </label>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="text-muted text-sm underline"
                    onClick={() =>
                      setRows((rs) => rs.filter((x) => x.key !== r.key))
                    }
                  >
                    삭제
                  </button>
                )}
              </div>
              <input
                id={`item-${r.key}`}
                name={`items.${i}.name`}
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value })}
                placeholder="예: 현미밥 1공기"
                autoComplete="off"
                className={inputClass}
              />
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["kcal", "열량", "kcal"],
                    ["carbsG", "탄수화물", "g"],
                    ["proteinG", "단백질", "g"],
                  ] as const
                ).map(([k, label, unit]) => (
                  <label key={k} className="flex flex-col gap-1 text-xs">
                    <span className="text-muted">
                      {label}({unit})
                    </span>
                    <input
                      name={`items.${i}.${k}`}
                      inputMode="numeric"
                      autoComplete="off"
                      value={r[k]}
                      onChange={(e) => update(r.key, { [k]: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
              <FieldError
                message={
                  errors[`items.${i}.name`] ??
                  errors[`items.${i}.kcal`] ??
                  errors[`items.${i}.carbsG`] ??
                  errors[`items.${i}.proteinG`]
                }
              />
            </div>
          ))}
          {rows.length < MAX_MEAL_ITEMS && (
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, emptyRow(nextKey)])}
              className="text-primary border-primary/40 min-h-12 rounded-xl border border-dashed text-sm font-semibold"
            >
              + 음식 추가
            </button>
          )}
          <FieldError message={errors.items} />
        </fieldset>
        <FormFeedback state={state} />
        <SubmitButton pending={pending}>식사 기록하기</SubmitButton>
      </form>
    </div>
  );
}
