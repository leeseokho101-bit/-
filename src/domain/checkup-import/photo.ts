import { z } from "zod";
import { IMPORTABLE_CODES, type RawCheckupData } from "./types";

export const PHOTO_READER_VERSION = "checkup-photo-v1";

/**
 * 결과표 사진 판독 결과 (LLM 구조화 출력).
 * 이름·주민등록번호 등 식별정보 필드는 두지 않는다 — 스키마에 없으면 돌려받지 않는다.
 */
export const photoReadSchema = z.object({
  isCheckupResult: z.boolean(),
  checkupDate: z.string().nullable(),
  items: z.array(
    z.object({
      metric: z.enum(IMPORTABLE_CODES),
      value: z.number(),
      unit: z.string(),
    }),
  ),
});
export type PhotoRead = z.infer<typeof photoReadSchema>;

/** Claude structured outputs용 JSON Schema (photoReadSchema와 같은 구조) */
export const photoReadJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["isCheckupResult", "checkupDate", "items"],
  properties: {
    isCheckupResult: { type: "boolean" },
    checkupDate: { anyOf: [{ type: "string" }, { type: "null" }] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["metric", "value", "unit"],
        properties: {
          metric: { type: "string", enum: [...IMPORTABLE_CODES] },
          value: { type: "number" },
          unit: { type: "string" },
        },
      },
    },
  },
} as const;

export function photoReadToRaw(read: PhotoRead): RawCheckupData {
  return {
    checkupDate: read.checkupDate,
    items: read.items.map((i) => ({ ...i, unit: i.unit || null })),
  };
}

// ─── 업로드 이미지 검사 ───

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export type PhotoMediaType = "image/jpeg" | "image/png" | "image/webp";

/** 확장자·Content-Type이 아니라 파일 앞부분(시그니처)으로 형식을 확인한다 */
export function sniffImageType(bytes: Uint8Array): PhotoMediaType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)
  )
    return "image/png";
  if (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
