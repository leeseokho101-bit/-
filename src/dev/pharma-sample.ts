/**
 * 제약사 포털 데모 (개발 전용). 가상 의원 6곳(3개 지역)과 "제약사 통계 제공"에 동의한 가상 환자 40명.
 * 투약 경과는 규칙으로 만든다: 일부는 증량 직후 부작용으로 중단, 일부는 기록이 끊김(사유 미입력).
 */
import type { PrismaClient } from "@prisma/client";
import { CARE_CONSENT_VERSION } from "@/content/care";
import { getDrug } from "@/domain/glp1/drugs";
import { addDaysIso, HOUR_MS, kstDateTime } from "@/domain/glp1/time";
import { assertSampleEnvironment } from "./seed-sample";

export const PHARMA_SAMPLE = {
  orgName: "가상제약(데모)",
  drugCodes: ["TIRZEPATIDE_WEEKLY"],
  memberEmail: "sample-pharma@example.invalid",
  memberName: "가상 제약사 담당자",
  patientPrefix: "sample-pharma-p",
  clinicPrefix: "DEMO-PH",
} as const;

const CLINICS = [
  ["서울", 3],
  ["경기", 2],
  ["부산", 1],
] as const;

const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

export async function resetPharmaSample(
  db: PrismaClient,
  passwordHash: string,
  now: number = Date.now(),
): Promise<string> {
  assertSampleEnvironment();
  const today = new Date(now + 9 * HOUR_MS).toISOString().slice(0, 10);
  await db.user.deleteMany({
    where: {
      isSample: true,
      email: { startsWith: PHARMA_SAMPLE.patientPrefix },
    },
  });
  await db.user.deleteMany({
    where: { isSample: true, email: PHARMA_SAMPLE.memberEmail },
  });
  await db.clinic.deleteMany({
    where: { isSample: true, code: { startsWith: PHARMA_SAMPLE.clinicPrefix } },
  });

  const clinicIds: string[] = [];
  let n = 0;
  for (const [region, count] of CLINICS)
    for (let i = 0; i < count; i++) {
      n++;
      const c = await db.clinic.create({
        data: {
          code: `${PHARMA_SAMPLE.clinicPrefix}-${n}`,
          name: `가상 ${region} 의원 ${i + 1}`,
          region,
          isSample: true,
        },
      });
      clinicIds.push(c.id);
    }

  for (let i = 0; i < 40; i++) {
    const tirz = i % 4 !== 3;
    const drug = getDrug(
      tirz ? "TIRZEPATIDE_WEEKLY" : "SEMAGLUTIDE_WEEKLY_OB",
    )!;
    const start = addDaysIso(today, -(30 + ((i * 7) % 100)));
    // 경과: 0~19 계속, 20~29 증량 직후 부작용 중단, 30~34 비용 중단, 35~39 기록 끊김
    const weeks = Math.floor(
      (Date.parse(today) - Date.parse(start)) / (7 * 86400000),
    );
    const kind =
      i < 20 ? "ongoing" : i < 30 ? "side" : i < 35 ? "cost" : "lapse";
    const takenWeeks =
      kind === "ongoing"
        ? weeks + 1
        : kind === "side"
          ? 5
          : kind === "cost"
            ? 3 + (i % 3)
            : 2 + (i % 2);
    const doseAt = (w: number) =>
      drug.doseSteps[Math.min(Math.floor(w / 4), drug.doseSteps.length - 1)];
    const stopDate =
      kind === "side" || kind === "cost"
        ? addDaysIso(start, takenWeeks * 7)
        : null;
    const user = await db.user.create({
      data: {
        email: `${PHARMA_SAMPLE.patientPrefix}${String(i).padStart(2, "0")}@example.invalid`,
        displayName: `통계용 가상 환자 ${i + 1}`,
        passwordHash,
        isSample: true,
        careEnrollment: {
          create: {
            clinicId: clinicIds[i % clinicIds.length],
            linkedAt: new Date(now),
            drugCode: drug.code,
            currentDoseMg: doseAt(takenWeeks - 1),
            doseSince: dateOf(start),
            startDate: dateOf(start),
            consentVersion: CARE_CONSENT_VERSION,
            consentAt: new Date(now),
            allowPharmaStats: i !== 0, // 동의하지 않은 1명은 집계에서 빠진다
            createdAt: kstDateTime(start, "10:00"),
            stoppedAt: stopDate && stopDate <= today ? dateOf(stopDate) : null,
            stopReason:
              stopDate && stopDate <= today
                ? kind === "side"
                  ? "SIDE_EFFECTS"
                  : "COST"
                : null,
          },
        },
      },
    });
    const doses = Array.from({ length: takenWeeks }, (_, w) =>
      addDaysIso(start, w * 7),
    )
      .filter((d) => d <= today)
      .map((d, w) => ({
        userId: user.id,
        takenAt: kstDateTime(d, "09:00"),
        status: "TAKEN" as const,
        doseMg: doseAt(w),
        site: "ABDOMEN_LEFT" as const,
      }));
    await db.doseLog.createMany({ data: doses });
    if (kind === "side") {
      // 증량 직후 속 불편 기록
      const last = doses.at(-1)!.takenAt.toISOString().slice(0, 10);
      await db.symptomCheckIn.createMany({
        data: [0, 1, 2].map((k) => ({
          userId: user.id,
          date: dateOf(addDaysIso(last, k)),
          symptoms: { NAUSEA: 2, VOMITING: k === 1 ? 2 : 0 },
          redFlags: [],
          triage: "CONTACT_CLINIC" as const,
        })),
      });
    }
  }

  const org = await db.pharmaOrg.upsert({
    where: { name: PHARMA_SAMPLE.orgName },
    create: {
      name: PHARMA_SAMPLE.orgName,
      drugCodes: [...PHARMA_SAMPLE.drugCodes],
    },
    update: { drugCodes: [...PHARMA_SAMPLE.drugCodes] },
  });
  const member = await db.user.create({
    data: {
      email: PHARMA_SAMPLE.memberEmail,
      displayName: PHARMA_SAMPLE.memberName,
      passwordHash,
      isSample: true,
      pharmaMember: { create: { orgId: org.id } },
    },
  });
  return member.id;
}
