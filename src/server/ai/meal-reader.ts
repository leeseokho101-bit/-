import "server-only";
import {
  MEAL_PHOTO_VERSION,
  mealPhotoJsonSchema,
  mealPhotoSchema,
  type MealPhotoRead,
} from "@/domain/glp1/meal";
import type { PhotoMediaType } from "@/domain/checkup-import/photo";
import { getServerEnv } from "@/server/env";
import { MEAL_PHOTO_SYSTEM_PROMPT } from "./prompts";
import {
  getAnthropicCreate,
  requestStructured,
  type CreateFn,
} from "./provider";

/** 식사 사진 추정기 — 교체·테스트가 쉽도록 인터페이스로 분리 */
export interface MealPhotoReader {
  readonly model: string;
  readonly version: string;
  read(image: {
    data: Uint8Array;
    mediaType: PhotoMediaType;
  }): Promise<MealPhotoRead>;
}

export class AnthropicMealPhotoReader implements MealPhotoReader {
  readonly version = MEAL_PHOTO_VERSION;

  constructor(
    readonly model: string,
    private readonly create: CreateFn,
  ) {}

  read(image: {
    data: Uint8Array;
    mediaType: PhotoMediaType;
  }): Promise<MealPhotoRead> {
    return requestStructured(this.create, this.model, {
      system: MEAL_PHOTO_SYSTEM_PROMPT,
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
          text: "이 식사 사진의 음식과 영양 성분을 추정해 주세요.",
        },
      ],
      jsonSchema: mealPhotoJsonSchema,
      schema: mealPhotoSchema,
      // 대략적인 추정이라 낮은 effort로 충분
      effort: "low",
    });
  }
}

/** API Key가 없으면 null → 사진 추정 없이 직접 입력만 */
export function getMealPhotoReader(): MealPhotoReader | null {
  const create = getAnthropicCreate(60_000);
  if (!create) return null;
  return new AnthropicMealPhotoReader(getServerEnv().LLM_MODEL, create);
}

export function isMealPhotoAvailable(): boolean {
  return !!getServerEnv().ANTHROPIC_API_KEY;
}
