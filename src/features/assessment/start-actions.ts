"use server";

import { redirect } from "next/navigation";
import { CONSENT_VERSION } from "@/content/consent";
import type { FormState } from "@/lib/form-state";
import { assessmentStepPath, routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getOrCreateDraftAssessment } from "./service";

export async function startAssessment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(routes.assessment);

  if (!user.consentAt) {
    if (
      formData.get("consentPrivacy") !== "on" ||
      formData.get("consentHealth") !== "on"
    ) {
      return { message: "건강분석을 위해 필수 항목에 모두 동의해 주세요." };
    }
    await db.user.update({
      where: { id: user.id },
      data: { consentAt: new Date(), consentVersion: CONSENT_VERSION },
    });
  }

  await getOrCreateDraftAssessment(user.id);
  redirect(assessmentStepPath("profile"));
}
