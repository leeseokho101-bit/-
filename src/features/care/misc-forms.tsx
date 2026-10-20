"use client";

import { useActionState } from "react";
import { buttonBase } from "@/components/ui/button-link";
import { deleteCareDataAction, uploadGlucoseAction } from "./actions";
import { FormFeedback, SubmitButton } from "./form-bits";

/** CGM 앱에서 내보낸 CSV 파일 올리기 */
export function GlucoseUploadForm() {
  const [state, action, pending] = useActionState(uploadGlucoseAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="cgm-file" className="font-semibold">
        CGM 기록 파일 (CSV)
      </label>
      <input
        id="cgm-file"
        name="file"
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="file:bg-primary/10 file:text-primary text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:px-4 file:font-semibold"
      />
      <p className="text-muted text-sm leading-relaxed">
        CGM 앱이나 제조사 웹사이트에서 &lsquo;데이터 내보내기(CSV)&rsquo;로 받은
        파일을 올려 주세요. 시각과 혈당(mg/dL) 열을 자동으로 찾아요. 같은 기록을
        다시 올려도 중복 저장되지 않아요.
      </p>
      <FormFeedback state={state} />
      <SubmitButton pending={pending} pendingText="올리는 중…">
        파일 올리기
      </SubmitButton>
    </form>
  );
}

/** 케어 기록 삭제 (건강분석 기록은 남는다) */
export function DeleteCareForm() {
  const [state, action, pending] = useActionState(deleteCareDataAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed">
        투약·혈당·식사·체크인 기록, 코치와 나눈 대화, 의원 연결과 동의 내역을
        모두 지웁니다. 지운 기록은 되돌릴 수 없어요. 건강분석 결과는 그대로
        남아요.
      </p>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirm"
          className="accent-primary mt-0.5 size-5 shrink-0"
        />
        <span>위 내용을 확인했고, 케어 기록을 모두 삭제합니다.</span>
      </label>
      <FormFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonBase} w-full bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60`}
      >
        {pending ? "삭제 중…" : "케어 기록 삭제"}
      </button>
    </form>
  );
}
