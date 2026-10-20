import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PHARMA_SAMPLE, resetPharmaSample } from "@/dev/pharma-sample";
import { kstDateTime } from "@/domain/glp1/time";
import {
  getEnrollment,
  refreshAlerts,
  saveDose,
  saveEnrollment,
  saveTreatmentStop,
} from "@/features/care/service";
import {
  getPharmaMember,
  loadChannel,
  loadCourses,
  persistenceView,
} from "@/features/pharma/service";

if (process.env.NODE_ENV === "production") {
  throw new Error("DB integration tests must not run in production");
}

const db = new PrismaClient();
const TODAY = "2026-10-20";
const NOW = kstDateTime(TODAY, "15:00").getTime();
const EMAIL = "pharma-test-patient@example.invalid";
let memberId: string;

beforeAll(async () => {
  memberId = await resetPharmaSample(db, "scrypt$x$y", NOW);
});

afterAll(async () => {
  await db.user.deleteMany({
    where: {
      isSample: true,
      email: { in: [EMAIL, PHARMA_SAMPLE.memberEmail] },
    },
  });
  await db.user.deleteMany({
    where: {
      isSample: true,
      email: { startsWith: PHARMA_SAMPLE.patientPrefix },
    },
  });
  await db.clinic.deleteMany({
    where: { isSample: true, code: { startsWith: PHARMA_SAMPLE.clinicPrefix } },
  });
  await db.pharmaAccessLog.deleteMany({ where: { memberUserId: memberId } });
  await db.$disconnect();
});

describe("제약사 포털 (DB)", () => {
  it("제약사 계정만 포털 정보를 갖는다", async () => {
    const m = (await getPharmaMember(db, memberId))!;
    expect(m.drugCodes).toEqual(["TIRZEPATIDE_WEEKLY"]);
    const patient = await db.user.findFirstOrThrow({
      where: { email: { startsWith: PHARMA_SAMPLE.patientPrefix } },
    });
    expect(await getPharmaMember(db, patient.id)).toBeNull();
  });

  it("동의한 환자만, 자사 제품만 분석하고 개별 의원·환자 정보는 결과에 없다", async () => {
    // 데모 40명 중 터제파타이드 30명, 그중 1명은 동의 안 함
    const courses = await loadCourses(db, ["TIRZEPATIDE_WEEKLY"], TODAY);
    expect(courses).toHaveLength(29);
    expect(courses.every((c) => c.drugCode === "TIRZEPATIDE_WEEKLY")).toBe(
      true,
    );
    const { curve, dropout } = persistenceView(courses);
    expect(curve![0].persisting).toBe(100);
    expect(
      dropout!.reasons.find((r) => r.reason === "SIDE_EFFECTS")?.count,
    ).toBeGreaterThan(0);

    const channel = await loadChannel(db, TODAY);
    const text = JSON.stringify(channel);
    for (const forbidden of [
      "가상 서울 의원",
      PHARMA_SAMPLE.clinicPrefix,
      "통계용 가상 환자",
      "@example",
    ])
      expect(text).not.toContain(forbidden);
    // 지역 단위 행만 (부산 1곳·경기 2곳은 "그 밖의 지역"으로 합쳐짐)
    expect(channel.regions.map((r) => r.region)).not.toContain("부산");
    expect(channel.regions.map((r) => r.region)).toContain("서울");
  });

  it("환자가 치료 중단을 기록하면 투약 누락 알림을 만들지 않는다", async () => {
    await db.user.deleteMany({ where: { email: EMAIL } });
    const user = await db.user.create({
      data: { email: EMAIL, displayName: "테스트", isSample: true },
    });
    await saveEnrollment(
      db,
      user.id,
      {
        drugCode: "TIRZEPATIDE_WEEKLY",
        doseMg: 2.5,
        startDate: "2026-09-01",
        consentService: "on",
        shareWithClinic: false,
        allowResearch: false,
        allowPharmaStats: true,
      },
      TODAY,
    );
    await saveDose(db, user.id, {
      date: "2026-09-01",
      time: "09:00",
      status: "TAKEN",
      doseMg: 2.5,
      site: "ABDOMEN_LEFT",
    });
    await saveTreatmentStop(db, user.id, {
      date: "2026-09-10",
      reason: "COST",
    });
    expect((await getEnrollment(db, user.id))!.stopped).toEqual({
      date: "2026-09-10",
      reason: "COST",
    });
    const alerts = await refreshAlerts(db, user.id, TODAY);
    expect(alerts.map((a) => a.kind)).not.toContain("MISSED_DOSES");
    await saveTreatmentStop(db, user.id, null);
    expect((await getEnrollment(db, user.id))!.stopped).toBeNull();
  });
});
