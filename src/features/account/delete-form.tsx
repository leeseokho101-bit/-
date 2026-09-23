"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form/form-message";
import { buttonBase } from "@/components/ui/button-link";
import { deleteMyData } from "./actions";

export function DeleteDataForm() {
  const [state, action, pending] = useActionState(deleteMyData, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-muted text-sm leading-relaxed">
        계정과 함께 기본정보, 건강검진 수치, 생활습관 응답, 복용약, 분석 결과,
        12주 계획이 모두 삭제되며 되돌릴 수 없어요.
      </p>
      <label className="flex min-h-12 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="confirm"
          className="mt-1 size-5 shrink-0 accent-rose-700"
        />
        <span className="text-sm leading-relaxed">
          위 내용을 확인했으며 모든 데이터를 삭제합니다.
        </span>
      </label>
      <FormMessage message={state.message} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonBase} w-full border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 disabled:opacity-60`}
      >
        {pending ? "삭제 중…" : "내 데이터 전체 삭제"}
      </button>
    </form>
  );
}
