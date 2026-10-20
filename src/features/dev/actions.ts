"use server";

import { notFound, redirect } from "next/navigation";
import { sampleUsers, SAMPLE_PASSWORD } from "@/dev/samples";
import { resetCareSample } from "@/dev/care-sample";
import { resetClinicSample } from "@/dev/clinic-sample";
import { resetPharmaSample } from "@/dev/pharma-sample";
import { resetSampleUser } from "@/dev/seed-sample";
import { assessmentStepPath, routes } from "@/lib/routes";
import { hashPassword } from "@/server/auth/password";
import { createSession, deleteSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { isSampleDataAllowed } from "@/lib/demo-mode";
import { logger } from "@/server/logger";

/** 개발 전용: 샘플 사용자 데이터를 초기화하고 그 사용자로 로그인한다 */
export async function loginAsSample(formData: FormData): Promise<void> {
  if (!isSampleDataAllowed()) notFound();
  const sample = sampleUsers.find((s) => s.id === formData.get("sampleId"));
  if (!sample) notFound();

  const userId = await resetSampleUser(
    db,
    sample,
    await hashPassword(SAMPLE_PASSWORD),
  );
  await deleteSession();
  await createSession(userId);
  logger.info("dev sample login", { sampleId: sample.id, userId });
  redirect(assessmentStepPath("review"));
}

/** 개발 전용: GLP-1 케어 가상 환자를 다시 만들고 그 사용자로 로그인한다 */
export async function loginAsCareSample(): Promise<void> {
  if (!isSampleDataAllowed()) notFound();
  const userId = await resetCareSample(db, await hashPassword(SAMPLE_PASSWORD));
  await deleteSession();
  await createSession(userId);
  logger.info("dev care sample login", { userId });
  redirect(routes.care);
}

/** 개발 전용: 가상 의원(가상 환자 2명 포함)을 다시 만들고 가상 의사로 로그인한다 */
export async function loginAsClinicSample(): Promise<void> {
  if (!isSampleDataAllowed()) notFound();
  const { doctorId } = await resetClinicSample(
    db,
    await hashPassword(SAMPLE_PASSWORD),
  );
  await deleteSession();
  await createSession(doctorId);
  logger.info("dev clinic sample login", { userId: doctorId });
  redirect(routes.clinic);
}

/** 개발 전용: 같은 가상 의원 데모를 다시 만들고 가상 코치로 로그인한다 */
export async function loginAsCoachSample(): Promise<void> {
  if (!isSampleDataAllowed()) notFound();
  const { coachId } = await resetClinicSample(
    db,
    await hashPassword(SAMPLE_PASSWORD),
  );
  await deleteSession();
  await createSession(coachId);
  logger.info("dev coach sample login", { userId: coachId });
  redirect(routes.coach);
}

/** 개발 전용: 통계용 가상 의원·환자를 다시 만들고 가상 제약사 담당자로 로그인한다 */
export async function loginAsPharmaSample(): Promise<void> {
  if (!isSampleDataAllowed()) notFound();
  const userId = await resetPharmaSample(
    db,
    await hashPassword(SAMPLE_PASSWORD),
  );
  await deleteSession();
  await createSession(userId);
  logger.info("dev pharma sample login", { userId });
  redirect(routes.pharma);
}
