"use server";

import { revalidatePath } from "next/cache";
import { echoValues, toFieldErrors, type FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { formDataToObject } from "@/features/assessment/form-data";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { koreaDate } from "./date";
import { activityFormSchema } from "./schemas";
import { saveActivityLog } from "./service";

export async function saveActivityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(routes.activity);
  const parsed = activityFormSchema(koreaDate()).safeParse(
    formDataToObject(formData),
  );
  if (!parsed.success) {
    return {
      message: "입력 내용을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  }
  try {
    const result = await saveActivityLog(db, user.id, parsed.data);
    revalidatePath(routes.activity);
    revalidatePath(routes.reportBioAge);
    revalidatePath(routes.dashboard);
    return {
      notice:
        result === "deleted"
          ? "이 날의 기록을 지웠어요."
          : "저장했어요. 아래 예상 생체나이에 바로 반영돼요.",
    };
  } catch (error) {
    logger.error("activity log save failed", { userId: user.id, error });
    return {
      message: "저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      values: echoValues(formData),
    };
  }
}
