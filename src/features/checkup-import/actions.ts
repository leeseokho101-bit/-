"use server";

import { redirect } from "next/navigation";
import { importWarningText } from "@/content/checkup-import";
import { echoValues, toFieldErrors, type FormState } from "@/lib/form-state";
import { assessmentStepPath, routes } from "@/lib/routes";
import { requireDraftAssessment } from "@/features/assessment/service";
import { formDataToObject } from "@/features/assessment/form-data";
import { getCheckupPhotoReader } from "@/server/ai/checkup-reader";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { confirmImportFormSchema, importedValuesOf } from "./schemas";
import {
  PHOTO_DAILY_LIMIT,
  readCheckupPhoto,
  saveConfirmedImport,
  type PhotoReadFailure,
} from "./service";

export type PhotoReadState = {
  message?: string;
  result?: {
    importId: string;
    /** 확인 폼 기본값 (필드 이름 → 값) */
    defaults: Record<string, string>;
    warnings: string[];
  };
};

const FAILURE_MESSAGES: Record<PhotoReadFailure, string> = {
  "too-large": "사진 용량이 너무 커요. 다시 찍어 주세요.",
  "not-image": "사진 파일(JPG·PNG·WEBP)만 올릴 수 있어요.",
  "daily-limit": `사진 판독은 하루 ${PHOTO_DAILY_LIMIT}번까지 할 수 있어요. 직접 입력하거나 내일 다시 시도해 주세요.`,
  "not-checkup":
    "건강검진 결과표를 찾지 못했어요. 수치가 있는 면이 잘 보이게 다시 찍어 주세요.",
  "no-values":
    "읽을 수 있는 수치가 없었어요. 밝은 곳에서 수치 부분이 잘 보이게 다시 찍어 주세요.",
  failed:
    "사진을 읽는 중 문제가 발생했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.",
};

/** 1단계: 사진 판독 → 확인 화면용 값 (아직 저장하지 않음) */
export async function readPhotoAction(
  _prev: PhotoReadState,
  formData: FormData,
): Promise<PhotoReadState> {
  const { user, assessmentId } = await requireDraftAssessment(
    routes.checkupPhoto,
  );
  if (formData.get("consentPhoto") !== "on")
    return { message: "사진 전송 안내를 확인하고 체크해 주세요." };
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0)
    return { message: "결과표 사진을 선택해 주세요." };
  const reader = getCheckupPhotoReader();
  if (!reader)
    return {
      message: "지금은 사진 판독을 사용할 수 없어요. 직접 입력해 주세요.",
    };

  const result = await readCheckupPhoto(
    { db, reader },
    {
      userId: user.id,
      assessmentId,
      bytes: new Uint8Array(await photo.arrayBuffer()),
    },
  );
  if (!result.ok) return { message: FAILURE_MESSAGES[result.reason] };

  const defaults: Record<string, string> = { importId: result.importId };
  if (result.checkupDate) defaults.checkupDate = result.checkupDate;
  for (const [k, v] of Object.entries(result.values)) defaults[k] = String(v);
  return {
    result: {
      importId: result.importId,
      defaults,
      warnings: result.warnings.map(importWarningText),
    },
  };
}

/** 2단계: 사용자가 확인·수정한 값을 저장하고 건강검진 단계로 돌아간다 */
export async function saveImportAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, assessmentId } = await requireDraftAssessment(
    routes.checkupPhoto,
  );
  const parsed = confirmImportFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      message: "입력 내용을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  }
  let saved: boolean;
  try {
    saved = await db.$transaction((tx) =>
      saveConfirmedImport(tx, {
        userId: user.id,
        assessmentId,
        importId: parsed.data.importId,
        data: {
          checkupDate: parsed.data.checkupDate,
          values: importedValuesOf(parsed.data),
        },
      }),
    );
  } catch (error) {
    logger.error("checkup import save failed", { assessmentId, error });
    return {
      message: "저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  if (!saved)
    return {
      message: "이미 저장했거나 만료된 판독 결과예요. 사진을 다시 올려 주세요.",
    };
  logger.info("checkup import saved", { userId: user.id, assessmentId });
  redirect(assessmentStepPath("checkup"));
}
