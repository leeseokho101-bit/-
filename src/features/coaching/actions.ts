"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { referralReasonLabels, scopeReasonText } from "@/content/coaching";
import { MESSAGE_MAX_LENGTH } from "@/domain/coaching/scope";
import { requireEnrollment } from "@/features/care/session";
import type { FormState } from "@/lib/form-state";
import { coachPatientPath, routes } from "@/lib/routes";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import {
  claimPatient,
  getAssignedPatient,
  logCoachAccess,
  referToClinic,
  REFERRAL_REASONS,
  sendCoachMessage,
  sendPatientMessage,
} from "./service";
import { requireCoach } from "./session";

const bodySchema = z
  .string({ error: "메시지를 적어 주세요." })
  .trim()
  .min(1, "메시지를 적어 주세요.")
  .max(MESSAGE_MAX_LENGTH, "1,000자 이내로 적어 주세요.");

/** 환자 → 코치 */
export async function sendPatientMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireEnrollment(routes.careCoach);
  const parsed = bodySchema.safeParse(formData.get("body"));
  if (!parsed.success)
    return {
      message: parsed.error.issues[0].message,
      values: { body: String(formData.get("body") ?? "") },
    };
  await sendPatientMessage(db, user.id, parsed.data);
  revalidatePath(routes.care, "layout");
  return { notice: "보냈어요." };
}

async function authorize(formData: FormData) {
  const { coach } = await requireCoach(routes.coach);
  const patientId = formData.get("patientId");
  const patient =
    typeof patientId === "string"
      ? await getAssignedPatient(db, coach, patientId)
      : null;
  if (!patient) notFound();
  return { coach, patient };
}

/** 코치 → 환자 (코칭 범위를 벗어난 표현이면 보내지 않음) */
export async function sendCoachMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { coach, patient } = await authorize(formData);
  const body = String(formData.get("body") ?? "");
  const result = await sendCoachMessage(db, coach, patient.patientId, body);
  if (!result.ok)
    return {
      message: scopeReasonText[result.reason] ?? "보낼 수 없는 내용이 있어요.",
      values: { body },
    };
  await logCoachAccess(db, coach, "send-message", patient.patientId);
  revalidatePath(coachPatientPath(patient.patientId));
  revalidatePath(routes.coach);
  return { notice: "보냈어요." };
}

export async function claimPatientAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoach(routes.coach);
  const patientId = formData.get("patientId");
  if (
    typeof patientId === "string" &&
    (await claimPatient(db, coach, patientId))
  )
    await logCoachAccess(db, coach, "claim", patientId);
  revalidatePath(routes.coach);
}

const referralSchema = z.object({
  reason: z.enum(REFERRAL_REASONS, { error: "사유를 골라 주세요." }),
  note: z.string().trim().max(150, "150자 이내로 적어 주세요.").optional(),
});

/** 담당 의원에 확인 요청 (에스컬레이션) */
export async function referToClinicAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { coach, patient } = await authorize(formData);
  const parsed = referralSchema.safeParse({
    reason: formData.get("reason") ?? undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const detail = [referralReasonLabels[parsed.data.reason], parsed.data.note]
    .filter(Boolean)
    .join(" — ");
  const { visibleToClinic } = await referToClinic(db, coach, patient, detail);
  await logCoachAccess(db, coach, "refer-clinic", patient.patientId);
  logger.info("coach referral", {
    coachUserId: coach.userId,
    patientId: patient.patientId,
  });
  revalidatePath(coachPatientPath(patient.patientId));
  revalidatePath(routes.clinic);
  return {
    notice: visibleToClinic
      ? "담당 의원 화면에 확인 요청을 남겼어요. 환자에게도 안내했어요."
      : "환자가 의원 공유에 동의하지 않았거나 연결된 의원이 없어 의원 화면에는 표시되지 않아요. 환자에게 의원에 직접 연락하도록 안내했어요.",
  };
}
