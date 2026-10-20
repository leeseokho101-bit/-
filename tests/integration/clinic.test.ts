import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kstDateTime } from "@/domain/glp1/time";
import { saveCheckIn, saveDose, saveEnrollment } from "@/features/care/service";
import {
  acknowledgeAlerts,
  getPatientReport,
  getSharedPatient,
  getStaff,
  listClinicPatients,
  logAccess,
  recordVisit,
} from "@/features/clinic/service";
import { emptySymptoms } from "@/domain/glp1/symptoms";

if (process.env.NODE_ENV === "production") {
  throw new Error("DB integration tests must not run in production");
}

const db = new PrismaClient();
// 테스트 전용 가상 계정·의원 (실제 정보 아님)
const TAG = "clinic-test";
const TODAY = "2026-10-20";
const NOW = kstDateTime(TODAY, "15:00").getTime();
const ids: Record<string, string> = {};

async function user(key: string) {
  ids[key] = (
    await db.user.create({
      data: {
        email: `${TAG}-${key}@example.invalid`,
        displayName: key,
        isSample: true,
      },
    })
  ).id;
  return ids[key];
}

const enroll = (clinicCode: string, shareWithClinic: boolean) => ({
  clinicCode,
  drugCode: "TIRZEPATIDE_WEEKLY" as const,
  doseMg: 2.5,
  startDate: "2026-09-22",
  consentService: "on" as const,
  shareWithClinic,
  allowResearch: false,
  allowPharmaStats: false,
});

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await db.clinic.deleteMany({ where: { code: { in: ["CT-A", "CT-B"] } } });
  const a = await db.clinic.create({
    data: { code: "CT-A", name: "가상A의원", isSample: true },
  });
  const b = await db.clinic.create({
    data: { code: "CT-B", name: "가상B의원", isSample: true },
  });
  await db.clinicStaff.create({
    data: { userId: await user("doctorA"), clinicId: a.id },
  });
  await db.clinicStaff.create({
    data: { userId: await user("doctorB"), clinicId: b.id },
  });
  await saveEnrollment(db, await user("shared"), enroll("CT-A", true), TODAY);
  await saveEnrollment(db, await user("private"), enroll("CT-A", false), TODAY);
  await saveEnrollment(
    db,
    await user("otherClinic"),
    enroll("CT-B", true),
    TODAY,
  );
  await saveDose(db, ids.shared, {
    date: "2026-09-22",
    time: "09:00",
    status: "TAKEN",
    doseMg: 2.5,
    site: "ABDOMEN_LEFT",
  });
  await saveCheckIn(db, ids.shared, {
    date: "2026-10-19",
    symptoms: { ...emptySymptoms(), NAUSEA: 3 },
    redFlags: [],
    weightKg: 90,
  });
});

afterAll(async () => {
  const staffIds = [ids.doctorA, ids.doctorB].filter(Boolean);
  await db.clinicAccessLog.deleteMany({
    where: { staffUserId: { in: staffIds } },
  });
  await db.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await db.clinic.deleteMany({ where: { code: { in: ["CT-A", "CT-B"] } } });
  await db.$disconnect();
});

describe("의사 대시보드 (DB)", () => {
  it("의료진 계정만 의원 정보를 갖는다", async () => {
    expect((await getStaff(db, ids.doctorA))?.clinicName).toBe("가상A의원");
    expect(await getStaff(db, ids.shared)).toBeNull();
  });

  it("자기 의원 + 공유 동의 환자만 보인다", async () => {
    const a = (await getStaff(db, ids.doctorA))!;
    const { patients, alerts } = await listClinicPatients(
      db,
      a.clinicId,
      TODAY,
      NOW,
    );
    expect(patients.map((p) => p.patientId)).toEqual([ids.shared]);
    expect(await getSharedPatient(db, a.clinicId, ids.private)).toBeNull();
    expect(await getSharedPatient(db, a.clinicId, ids.otherClinic)).toBeNull();
    expect(
      await getPatientReport(db, a.clinicId, ids.otherClinic, TODAY, NOW),
    ).toBeNull();
    // 심한 증상 + 투약 누락 신호
    expect(new Set(alerts.map((x) => x.kind))).toEqual(
      new Set(["SEVERE_SYMPTOM", "MISSED_DOSES"]),
    );
    expect(patients[0].flag).toBe("ALERT");
  });

  it("리포트는 지난 내원 이후, 확인 처리·내원 기록·감사 기록", async () => {
    const a = (await getStaff(db, ids.doctorA))!;
    await recordVisit(db, a, ids.shared, "2026-10-13");
    await recordVisit(db, a, ids.shared, "2026-10-13");
    const r = (await getPatientReport(db, a.clinicId, ids.shared, TODAY, NOW))!;
    expect(r.period).toEqual({
      from: "2026-10-13",
      to: TODAY,
      sinceVisit: "2026-10-13",
    });
    expect(r.symptoms.bySymptom.NAUSEA.max).toBe(3);
    expect(r.adherence.last28.taken).toBe(0);
    expect(await acknowledgeAlerts(db, a, ids.shared)).toBeGreaterThan(0);
    const { patients } = await listClinicPatients(db, a.clinicId, TODAY, NOW);
    expect(patients[0].flag).not.toBe("ALERT");
    await logAccess(db, a, "view-report", ids.shared);
    expect(
      await db.clinicAccessLog.count({
        where: { staffUserId: ids.doctorA, patientId: ids.shared },
      }),
    ).toBe(1);
  });

  it("환자가 공유 동의를 철회하면 바로 볼 수 없다", async () => {
    await saveEnrollment(db, ids.shared, enroll("CT-A", false), TODAY);
    const a = (await getStaff(db, ids.doctorA))!;
    expect(await getSharedPatient(db, a.clinicId, ids.shared)).toBeNull();
    expect(
      (await listClinicPatients(db, a.clinicId, TODAY, NOW)).patients,
    ).toEqual([]);
  });
});
