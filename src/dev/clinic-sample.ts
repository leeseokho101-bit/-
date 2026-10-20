/**
 * 의사 대시보드 데모 (개발 전용). 가상 의원의 가상 의사 계정 + 가상 환자 2명.
 * 환자 1: 케어 가상 환자 (기록 많음, 저혈당 알림) · 환자 2: 투약·체크인이 끊긴 환자 (관찰)
 */
import type { PrismaClient } from "@prisma/client";
import { CARE_CONSENT_VERSION } from "@/content/care";
import { addDaysIso, HOUR_MS, kstDateTime } from "@/domain/glp1/time";
import { CARE_SAMPLE, resetCareSample } from "./care-sample";
import { assertSampleEnvironment } from "./seed-sample";

export const CLINIC_SAMPLE = {
  doctorEmail: "sample-doctor@example.invalid",
  doctorName: "가상 의사",
  patient2Email: "sample-care2@example.invalid",
  patient2Name: "케어 가상 환자 2",
} as const;

const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** 의사 계정 ID를 돌려준다 */
export async function resetClinicSample(
  db: PrismaClient,
  passwordHash: string,
  now: number = Date.now(),
): Promise<string> {
  assertSampleEnvironment();
  const today = new Date(now + 9 * HOUR_MS).toISOString().slice(0, 10);
  const patient1 = await resetCareSample(db, passwordHash, now);
  const clinic = await db.clinic.findUniqueOrThrow({
    where: { code: CARE_SAMPLE.clinicCode },
  });

  // 환자 1: 첫 투약일·증량일에 내원, 다음 내원은 이번 주
  const start = await db.careEnrollment.findUniqueOrThrow({
    where: { userId: patient1 },
  });
  const startIso = start.startDate.toISOString().slice(0, 10);
  await db.careEnrollment.update({
    where: { userId: patient1 },
    data: { nextVisitOn: dateOf(addDaysIso(today, 1)), chartNo: "DEMO-101" },
  });
  await db.clinicVisit.createMany({
    data: [startIso, addDaysIso(startIso, 28)].map((d) => ({
      clinicId: clinic.id,
      patientId: patient1,
      visitedOn: dateOf(d),
    })),
  });

  // 환자 2: 3주 전 시작, 첫 주만 투약 기록, 체크인 없음
  await db.user.deleteMany({
    where: { email: CLINIC_SAMPLE.patient2Email, isSample: true },
  });
  const p2Start = addDaysIso(today, -20);
  await db.user.create({
    data: {
      email: CLINIC_SAMPLE.patient2Email,
      displayName: CLINIC_SAMPLE.patient2Name,
      passwordHash,
      isSample: true,
      consentAt: new Date(now),
      consentVersion: "sample",
      careEnrollment: {
        create: {
          clinicId: clinic.id,
          linkedAt: new Date(now),
          drugCode: "SEMAGLUTIDE_WEEKLY_OB",
          currentDoseMg: 0.25,
          doseSince: dateOf(p2Start),
          startDate: dateOf(p2Start),
          consentVersion: CARE_CONSENT_VERSION,
          consentAt: new Date(now),
          shareWithClinic: true,
          nextVisitOn: dateOf(addDaysIso(today, 8)),
        },
      },
      doseLogs: {
        create: {
          takenAt: kstDateTime(p2Start, "20:00"),
          status: "TAKEN",
          doseMg: 0.25,
          site: "THIGH_LEFT",
        },
      },
    },
  });

  await db.user.deleteMany({
    where: { email: CLINIC_SAMPLE.doctorEmail, isSample: true },
  });
  const doctor = await db.user.create({
    data: {
      email: CLINIC_SAMPLE.doctorEmail,
      displayName: CLINIC_SAMPLE.doctorName,
      passwordHash,
      isSample: true,
      clinicStaff: { create: { clinicId: clinic.id, role: "DOCTOR" } },
    },
  });
  return doctor.id;
}
