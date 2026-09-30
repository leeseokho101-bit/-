"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { InputField, NumberField } from "@/components/form/controls";
import { FormMessage } from "@/components/form/form-message";
import { StepForm } from "@/components/form/step-form";
import { buttonBase, ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PHOTO_CONSENT_ITEMS, PHOTO_TIPS } from "@/content/checkup-import";
import { IMPORTABLE_CODES } from "@/domain/checkup-import/types";
import { METRICS } from "@/domain/health-snapshot/metrics";
import { readPhotoAction, saveImportAction } from "./actions";

/** 긴 변 기준 최대 픽셀 — 결과표 글자를 읽기에 충분하고 업로드는 가볍게 */
const MAX_EDGE = 2000;

/** 브라우저에서 사진을 줄여 JPEG로 변환 (휴대폰 원본은 수 MB라 업로드가 느리다) */
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
      0.85,
    ),
  );
}

export function PhotoImport({ backHref }: { backHref: string }) {
  const [state, readAction, pending] = useActionState(readPhotoAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview)),
    [preview],
  );

  const result =
    state.result && state.result.importId !== dismissed ? state.result : null;

  if (result) {
    return (
      <ConfirmImport
        result={result}
        backHref={backHref}
        onRetake={() => {
          setDismissed(result.importId);
          setPreview(null);
        }}
      />
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("photo");
    if (file instanceof File && file.size > 0) {
      try {
        fd.set("photo", await shrinkImage(file), "checkup.jpg");
      } catch {
        // 변환하지 못하는 형식이면 원본을 보내고 서버에서 형식·크기를 확인한다
      }
    }
    startTransition(() => readAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5" noValidate>
      <Card className="bg-primary/5 border-primary/20">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
          {PHOTO_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Card>

      <label className="border-border bg-surface hover:bg-background has-[:focus-visible]:outline-primary flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center has-[:focus-visible]:outline-2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob:)라 최적화 대상 아님
          <img
            src={preview}
            alt="선택한 결과표 사진 미리보기"
            className="max-h-72 rounded-lg object-contain"
          />
        ) : (
          <>
            <span aria-hidden className="text-4xl">
              📷
            </span>
            <span className="font-semibold">결과표 사진 찍기 · 선택하기</span>
          </>
        )}
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        {preview && (
          <span className="text-muted text-sm">눌러서 다시 선택</span>
        )}
      </label>

      <Card>
        <ul className="text-muted flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
          {PHOTO_CONSENT_ITEMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <label className="border-border mt-3 flex min-h-12 cursor-pointer items-start gap-3 border-t pt-3">
          <input
            type="checkbox"
            name="consentPhoto"
            className="accent-primary mt-1 size-5 shrink-0"
          />
          <span className="leading-relaxed">
            위 내용을 확인했고, 사진 전송에 동의합니다.
          </span>
        </label>
      </Card>

      <FormMessage message={state.message} />
      <div className="mt-auto grid grid-cols-[1fr_2fr] gap-3 pt-4">
        <ButtonLink href={backHref} variant="secondary">
          이전
        </ButtonLink>
        <button
          type="submit"
          disabled={pending}
          aria-disabled={pending}
          className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90 w-full disabled:opacity-60`}
        >
          {pending ? "읽는 중… (최대 1분)" : "사진에서 수치 읽기"}
        </button>
      </div>
    </form>
  );
}

function ConfirmImport({
  result,
  backHref,
  onRetake,
}: {
  result: NonNullable<Awaited<ReturnType<typeof readPhotoAction>>["result"]>;
  backHref: string;
  onRetake: () => void;
}) {
  const codes = IMPORTABLE_CODES.filter(
    (c) => result.defaults[c] !== undefined,
  );
  return (
    <>
      <Card className="bg-primary/5 border-primary/20">
        <p className="leading-relaxed">
          <strong>사진에서 {codes.length}개 항목을 읽었어요.</strong> 결과표와
          한 번 비교해 보시고, 틀린 값은 고치거나 지워 주세요. 저장하기 전에는
          아무것도 기록되지 않습니다.
        </p>
      </Card>
      {result.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-amber-900">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}
      <StepForm
        action={saveImportAction}
        defaults={result.defaults}
        prevHref={backHref}
        submitLabel="확인했어요, 저장"
      >
        <input type="hidden" name="importId" value={result.importId} />
        <InputField
          name="checkupDate"
          label="검진 받은 날짜"
          type="date"
          optional
        />
        {codes.map((code) => {
          const m = METRICS[code];
          return (
            <NumberField
              key={code}
              name={code}
              label={m.label}
              unit={m.unit}
              decimals={m.decimals}
              optional
            />
          );
        })}
        <button
          type="button"
          onClick={onRetake}
          className={`${buttonBase} text-primary hover:bg-primary/5`}
        >
          다시 찍기
        </button>
      </StepForm>
    </>
  );
}
