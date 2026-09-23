import { z } from "zod";

/**
 * FormData → 중첩 객체. name="sleep.avgHours" → { sleep: { avgHours } }
 * 빈 문자열은 "응답 안 함"으로 보고 제외한다.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string" || key.startsWith("$ACTION")) continue;
    const value = raw.trim();
    if (value === "") continue;
    const parts = key.split(".");
    let node = out;
    for (const part of parts.slice(0, -1)) {
      node[part] = (node[part] as Record<string, unknown>) ?? {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return arrayify(out) as Record<string, unknown>;
}

/** { "0": a, "1": b } 처럼 숫자 키만 있는 객체를 배열로 (name="meds.0.name" 지원) */
function arrayify(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const entries = Object.entries(node).map(
    ([k, v]) => [k, arrayify(v)] as const,
  );
  if (entries.length > 0 && entries.every(([k]) => /^\d+$/.test(k))) {
    return entries.sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v);
  }
  return Object.fromEntries(entries);
}

/** "1,234.5" 같은 입력을 숫자로. 숫자가 아니면 NaN → zod 오류 */
export const numeric = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/,/g, "")) : v),
    schema,
  );

export const yesNo = z.preprocess(
  (v) => (v === "yes" ? true : v === "no" ? false : v),
  z.boolean(),
);

/** 객체를 폼 기본값(평면 문자열 맵)으로 */
export function flattenToFormValues(
  obj: Record<string, unknown>,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "boolean") out[key] = v ? "yes" : "no";
    else if (typeof v === "object" && !Array.isArray(v) && !(v instanceof Date))
      flattenToFormValues(v as Record<string, unknown>, key, out);
    else out[key] = String(v);
  }
  return out;
}
