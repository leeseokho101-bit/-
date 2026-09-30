import "server-only";
import {
  PHOTO_READER_VERSION,
  photoReadJsonSchema,
  photoReadSchema,
  type PhotoMediaType,
  type PhotoRead,
} from "@/domain/checkup-import/photo";
import { getServerEnv } from "@/server/env";
import { CHECKUP_PHOTO_SYSTEM_PROMPT } from "./prompts";
import {
  getAnthropicCreate,
  requestStructured,
  type CreateFn,
} from "./provider";

/** 건강검진 결과표 사진 판독기 — 교체·테스트가 쉽도록 인터페이스로 분리 */
export interface CheckupPhotoReader {
  readonly model: string;
  readonly version: string;
  read(image: {
    data: Uint8Array;
    mediaType: PhotoMediaType;
  }): Promise<PhotoRead>;
}

export class AnthropicCheckupPhotoReader implements CheckupPhotoReader {
  readonly version = PHOTO_READER_VERSION;

  constructor(
    readonly model: string,
    private readonly create: CreateFn,
  ) {}

  read(image: {
    data: Uint8Array;
    mediaType: PhotoMediaType;
  }): Promise<PhotoRead> {
    return requestStructured(this.create, this.model, {
      system: CHECKUP_PHOTO_SYSTEM_PROMPT,
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType,
            data: Buffer.from(image.data).toString("base64"),
          },
        },
        {
          type: "text",
          text: "이 사진의 건강검진 결과 수치를 옮겨 적어 주세요.",
        },
      ],
      jsonSchema: photoReadJsonSchema,
      schema: photoReadSchema,
      // 숫자를 정확히 옮기는 작업이라 설명 생성보다 한 단계 높인다
      effort: "medium",
    });
  }
}

/** API Key가 없으면 null → 사진 판독 기능을 숨기고 직접 입력만 안내 */
export function getCheckupPhotoReader(): CheckupPhotoReader | null {
  const create = getAnthropicCreate(90_000);
  if (!create) return null;
  return new AnthropicCheckupPhotoReader(getServerEnv().LLM_MODEL, create);
}

export function isCheckupPhotoAvailable(): boolean {
  return !!getServerEnv().ANTHROPIC_API_KEY;
}
