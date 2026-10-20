"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PHOTO_MAX_BYTES, sniffImageType } from "@/domain/checkup-import/photo";
import { parseCgmCsv } from "@/domain/glp1/csv";
import { cleanMealPhotoRead, type MealItem } from "@/domain/glp1/meal";
import { koreaDate } from "@/features/activity/date";
import { formDataToObject } from "@/features/assessment/form-data";
import { echoValues, toFieldErrors, type FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { getMealPhotoReader } from "@/server/ai/meal-reader";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import {
  checkInFormSchema,
  currentDoseFormSchema,
  doseFormSchema,
  enrollFormSchema,
  mealFormSchema,
  MEAL_PHOTO_DAILY_LIMIT,
} from "./schemas";
import {
  countAiUsageToday,
  deleteCareData,
  deleteDose,
  deleteMeal,
  importGlucose,
  recordAiUsage,
  refreshAlerts,
  saveCheckIn,
  saveCurrentDose,
  saveDose,
  saveEnrollment,
  saveMeal,
} from "./service";
import { requireEnrollment } from "./session";

const SAVE_FAILED = "저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
const INVALID = "입력 내용을 확인해 주세요.";

function revalidateCare() {
  revalidatePath(routes.care, "layout");
}

/** 프로그램 등록·설정 저장 → 케어 홈 */
export async function enrollAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(routes.careStart);
  const today = koreaDate();
  const parsed = enrollFormSchema(today).safeParse(formDataToObject(formData));
  if (!parsed.success)
    return {
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  let result: "saved" | "no-clinic";
  try {
    result = await saveEnrollment(db, user.id, parsed.data, today);
  } catch (error) {
    logger.error("care enrollment save failed", { userId: user.id, error });
    return { message: SAVE_FAILED, values: echoValues(formData) };
  }
  if (result === "no-clinic")
    return {
      message: INVALID,
      fieldErrors: {
        clinicCode:
          "등록된 의원 코드가 아니에요. 카드의 코드를 다시 확인하거나 비워 두고 나중에 연결하세요.",
      },
      values: echoValues(formData),
    };
  logger.info("care enrollment saved", { userId: user.id });
  revalidateCare();
  redirect(routes.care);
}

/** 담당 의사가 바꾼 용량 기록 */
export async function updateCurrentDoseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, enrollment, today } = await requireEnrollment(routes.careDose);
  const parsed = currentDoseFormSchema(today, enrollment.drug.code).safeParse(
    formDataToObject(formData),
  );
  if (!parsed.success)
    return {
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  try {
    await saveCurrentDose(db, user.id, parsed.data);
  } catch (error) {
    logger.error("care dose update failed", { userId: user.id, error });
    return { message: SAVE_FAILED };
  }
  revalidateCare();
  return {
    notice: "현재 용량을 바꿨어요. 다음 투약부터 이 용량으로 기록돼요.",
  };
}

export async function saveDoseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, enrollment, today } = await requireEnrollment(routes.careDose);
  const parsed = doseFormSchema(today, enrollment.drug.code).safeParse(
    formDataToObject(formData),
  );
  if (!parsed.success)
    return {
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  try {
    await saveDose(db, user.id, parsed.data);
    await refreshAlerts(db, user.id, today);
  } catch (error) {
    logger.error("care dose save failed", { userId: user.id, error });
    return { message: SAVE_FAILED, values: echoValues(formData) };
  }
  revalidateCare();
  return {
    notice:
      parsed.data.status === "TAKEN"
        ? "투약을 기록했어요."
        : "놓친 투약을 기록했어요. 다음 투약을 언제 할지 모르겠다면 담당 의원에 물어보세요.",
  };
}

export async function deleteDoseAction(formData: FormData): Promise<void> {
  const { user } = await requireEnrollment(routes.careDose);
  const id = formData.get("id");
  if (typeof id === "string") await deleteDose(db, user.id, id);
  revalidateCare();
}

const CSV_MAX_BYTES = 4 * 1024 * 1024;

/** CGM 앱에서 내보낸 CSV 올리기 */
export async function uploadGlucoseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, today } = await requireEnrollment(routes.careGlucose);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { message: "CGM 앱에서 내보낸 파일을 선택해 주세요." };
  if (file.size > CSV_MAX_BYTES)
    return {
      message: "파일이 너무 커요. 기간을 나눠 내보내 주세요 (최대 4MB).",
    };
  const parsed = parseCgmCsv(await file.text());
  if (!parsed.ok)
    return {
      message:
        parsed.reason === "no-header"
          ? "시각과 혈당(mg/dL) 열을 찾지 못했어요. CGM 앱에서 CSV로 내보낸 파일인지 확인해 주세요."
          : parsed.reason === "too-many-rows"
            ? "기록이 너무 많아요. 기간을 나눠 내보내 주세요."
            : "읽을 수 있는 혈당 값이 없었어요.",
    };
  try {
    const inserted = await importGlucose(
      db,
      user.id,
      parsed.readings,
      "CSV_UPLOAD",
    );
    await refreshAlerts(db, user.id, today);
    logger.info("glucose csv imported", {
      userId: user.id,
      rows: parsed.readings.length,
      inserted,
    });
    revalidateCare();
    const dup = parsed.readings.length - inserted;
    return {
      notice: `혈당 ${inserted.toLocaleString()}개를 저장했어요.${dup ? ` (이미 있는 ${dup.toLocaleString()}개는 건너뜀)` : ""}${parsed.skipped ? ` 읽지 못한 ${parsed.skipped.toLocaleString()}줄은 제외했어요.` : ""}`,
    };
  } catch (error) {
    logger.error("glucose csv import failed", { userId: user.id, error });
    return { message: SAVE_FAILED };
  }
}

export async function saveCheckInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, today } = await requireEnrollment(routes.careCheckIn);
  const parsed = checkInFormSchema(today).safeParse(formDataToObject(formData));
  if (!parsed.success)
    return {
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  try {
    await saveCheckIn(db, user.id, parsed.data);
    await refreshAlerts(db, user.id, today);
  } catch (error) {
    logger.error("care check-in save failed", { userId: user.id, error });
    return { message: SAVE_FAILED, values: echoValues(formData) };
  }
  revalidateCare();
  return { notice: "체크인을 저장했어요. 아래 안내를 확인해 주세요." };
}

export async function saveMealAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireEnrollment(routes.careMeals);
  const parsed = mealFormSchema(koreaDate()).safeParse(
    formDataToObject(formData),
  );
  if (!parsed.success)
    return {
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  try {
    await saveMeal(db, user.id, parsed.data);
  } catch (error) {
    logger.error("care meal save failed", { userId: user.id, error });
    return { message: SAVE_FAILED, values: echoValues(formData) };
  }
  revalidateCare();
  return {
    notice:
      "식사를 기록했어요. 혈당 기록이 있으면 식후 반응이 아래에 함께 보여요.",
  };
}

export async function deleteMealAction(formData: FormData): Promise<void> {
  const { user } = await requireEnrollment(routes.careMeals);
  const id = formData.get("id");
  if (typeof id === "string") await deleteMeal(db, user.id, id);
  revalidateCare();
}

export type MealPhotoState = {
  message?: string;
  /** 확인 폼에 채울 항목 (저장 전) */
  result?: { key: string; items: MealItem[] };
};

/** 식사 사진 → 음식·영양 추정 (저장하지 않는다. 사진도 저장하지 않는다) */
export async function readMealPhotoAction(
  _prev: MealPhotoState,
  formData: FormData,
): Promise<MealPhotoState> {
  const { user, today } = await requireEnrollment(routes.careMeals);
  if (formData.get("consentPhoto") !== "on")
    return { message: "사진 전송 안내를 확인하고 체크해 주세요." };
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0)
    return { message: "식사 사진을 선택해 주세요." };
  if (photo.size > PHOTO_MAX_BYTES)
    return { message: "사진 용량이 너무 커요. 다시 찍어 주세요." };
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType)
    return { message: "사진 파일(JPG·PNG·WEBP)만 올릴 수 있어요." };
  const reader = getMealPhotoReader();
  if (!reader)
    return {
      message: "지금은 사진 추정을 사용할 수 없어요. 직접 입력해 주세요.",
    };
  if (
    (await countAiUsageToday(db, user.id, "meal-photo", today)) >=
    MEAL_PHOTO_DAILY_LIMIT
  )
    return {
      message: `사진 추정은 하루 ${MEAL_PHOTO_DAILY_LIMIT}번까지 할 수 있어요. 직접 입력해 주세요.`,
    };
  try {
    const read = await reader.read({ data: bytes, mediaType });
    const items = read.isFood ? cleanMealPhotoRead(read) : [];
    await recordAiUsage(db, user.id, "meal-photo", items.length > 0);
    if (!items.length)
      return {
        message:
          "음식을 찾지 못했어요. 음식이 잘 보이게 다시 찍거나 직접 입력해 주세요.",
      };
    return { result: { key: crypto.randomUUID(), items } };
  } catch (error) {
    await recordAiUsage(db, user.id, "meal-photo", false);
    logger.warn("meal photo read failed", { userId: user.id, error });
    return {
      message:
        "사진을 읽는 중 문제가 발생했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.",
    };
  }
}

/** 케어 기록 전체 삭제 (건강분석 기록은 남는다) */
export async function deleteCareDataAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(routes.careSettings);
  if (formData.get("confirm") !== "on")
    return { message: "삭제 안내를 확인하고 체크해 주세요." };
  await deleteCareData(db, user.id);
  logger.info("care data deleted", { userId: user.id });
  revalidateCare();
  redirect(routes.careStart);
}
