import type { z } from "zod";

/** Server Action ↔ 폼 공통 상태 */
export type FormState = {
  message?: string;
  /** 성공 안내 (예: 주간 피드백) */
  notice?: string;
  fieldErrors?: Record<string, string>;
  /** 오류 시 입력값 유지 */
  values?: Record<string, string>;
};

export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** 비밀번호 등 민감 입력을 제외한 값만 되돌려준다 */
export function echoValues(
  formData: FormData,
  omit: string[] = [],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !omit.includes(k) && !k.startsWith("$ACTION"))
      out[k] = v;
  }
  return out;
}
