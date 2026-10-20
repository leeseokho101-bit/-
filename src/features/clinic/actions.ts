"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formDataToObject } from "@/features/assessment/form-data";
import { echoValues, toFieldErrors, type FormState } from "@/lib/form-state";
import { clinicPatientPath, routes } from "@/lib/routes";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import {
  acknowledgeAlerts,
  getSharedPatient,
  logAccess,
  recordVisit,
  updateClinicFields,
} from "./service";
import { requireClinician } from "./session";

/** 의료진 + 이 의원의 공유 동의 환자인지 확인. 아니면 404 */
async function authorize(formData: FormData) {
  const patientId = formData.get("patientId");
  const { staff, today } = await requireClinician(routes.clinic);
  if (
    typeof patientId !== "string" ||
    !(await getSharedPatient(db, staff.clinicId, patientId))
  )
    notFound();
  return { staff, today, patientId };
}

function revalidate(patientId: string) {
  revalidatePath(routes.clinic);
  revalidatePath(clinicPatientPath(patientId));
}

export async function acknowledgeAlertsAction(
  formData: FormData,
): Promise<void> {
  const { staff, patientId } = await authorize(formData);
  const count = await acknowledgeAlerts(db, staff, patientId);
  await logAccess(db, staff, "ack-alert", patientId);
  logger.info("clinic alerts acknowledged", {
    staffUserId: staff.userId,
    patientId,
    count,
  });
  revalidate(patientId);
}

export async function recordVisitAction(formData: FormData): Promise<void> {
  const { staff, today, patientId } = await authorize(formData);
  await recordVisit(db, staff, patientId, today);
  await logAccess(db, staff, "record-visit", patientId);
  revalidate(patientId);
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 확인해 주세요.");

const clinicFieldsSchema = (today: string) =>
  z.object({
    nextVisitOn: isoDate
      .refine((d) => d >= today, "오늘 이후 날짜를 골라 주세요.")
      .optional(),
    chartNo: z
      .string()
      .trim()
      .max(30, "30자 이내로 적어 주세요.")
      .regex(/^[A-Za-z0-9-]*$/, "영문·숫자·-만 쓸 수 있어요.")
      .optional(),
  });

export async function updateClinicFieldsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { staff, today, patientId } = await authorize(formData);
  const parsed = clinicFieldsSchema(today).safeParse(
    formDataToObject(formData),
  );
  if (!parsed.success)
    return {
      message: "입력 내용을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  await updateClinicFields(db, patientId, {
    nextVisitOn: parsed.data.nextVisitOn ?? null,
    chartNo: parsed.data.chartNo || null,
  });
  await logAccess(db, staff, "update-clinic-fields", patientId);
  revalidate(patientId);
  return { notice: "저장했어요." };
}
