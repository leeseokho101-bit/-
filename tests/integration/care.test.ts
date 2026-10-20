import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CARE_SAMPLE, resetCareSample } from "@/dev/care-sample";
import { emptySymptoms } from "@/domain/glp1/symptoms";
import { kstDateTime, kstDayStart } from "@/domain/glp1/time";
import {
  deleteCareData,
  getEnrollment,
  importGlucose,
  listDoses,
  listMeals,
  loadGlucose,
  refreshAlerts,
  saveCheckIn,
  saveDose,
  saveEnrollment,
  saveMeal,
} from "@/features/care/service";

if (process.env.NODE_ENV === "production") {
  throw new Error("DB integration tests must not run in production");
}

const db = new PrismaClient();
// 테스트 전용 가상 계정·의원 (실제 정보 아님)
const EMAIL = "care-test@example.invalid";
const CLINIC = "TEST-CARE-01";
const TODAY = "2026-10-20";
let userId: string;

const enroll = {
  drugCode: "SEMAGLUTIDE_WEEKLY_OB" as const,
  doseMg: 0.25,
  startDate: "2026-09-22",
  consentService: "on" as const,
  shareWithClinic: true,
  allowResearch: false,
  allowPharmaStats: false,
};

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  userId = (
    await db.user.create({
      data: { email: EMAIL, displayName: "테스트", isSample: true },
    })
  ).id;
  await db.clinic.upsert({
    where: { code: CLINIC },
    create: { code: CLINIC, name: "테스트의원", isSample: true },
    update: {},
  });
});

afterAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [EMAIL, CARE_SAMPLE.email] } },
  });
  await db.clinic.deleteMany({ where: { code: CLINIC } });
  await db.$disconnect();
});

describe("GLP-1 케어 (DB)", () => {
  it("없는 의원 코드는 거절하고, 맞는 코드면 의원과 연결한다", async () => {
    expect(
      await saveEnrollment(
        db,
        userId,
        { ...enroll, clinicCode: "NOPE-0000" },
        TODAY,
      ),
    ).toBe("no-clinic");
    expect(await getEnrollment(db, userId)).toBeNull();
    expect(
      await saveEnrollment(
        db,
        userId,
        { ...enroll, clinicCode: CLINIC },
        TODAY,
      ),
    ).toBe("saved");
    const e = (await getEnrollment(db, userId))!;
    expect(e.clinic?.name).toBe("테스트의원");
    expect(e.doseSince).toBe(enroll.startDate);
    // 용량이 바뀌면 그날부터 새 용량
    await saveEnrollment(
      db,
      userId,
      { ...enroll, doseMg: 0.5, clinicCode: CLINIC },
      TODAY,
    );
    expect((await getEnrollment(db, userId))!.doseSince).toBe(TODAY);
  });

  it("혈당은 같은 시각을 다시 올려도 한 번만 저장된다", async () => {
    const base = kstDateTime("2026-10-19", "00:00").getTime();
    const readings = Array.from({ length: 8 }, (_, i) => ({
      measuredAt: new Date(base + i * 15 * 60_000),
      mgdl: i >= 2 && i <= 4 ? 60 : 110,
    }));
    expect(await importGlucose(db, userId, readings, "CSV_UPLOAD")).toBe(8);
    expect(await importGlucose(db, userId, readings, "CSV_UPLOAD")).toBe(0);
    expect(
      await loadGlucose(db, userId, base, base + 3 * 3600_000),
    ).toHaveLength(8);
  });

  it("식사는 혈당 기록과 이어 식후 반응을 계산한다", async () => {
    const base = kstDateTime("2026-10-18", "11:45").getTime();
    await importGlucose(
      db,
      userId,
      [98, 100, 130, 165, 150, 125, 115, 105, 100].map((mgdl, i) => ({
        measuredAt: new Date(base + i * 15 * 60_000),
        mgdl,
      })),
      "CSV_UPLOAD",
    );
    await saveMeal(db, userId, {
      date: "2026-10-18",
      time: "12:00",
      mealType: "LUNCH",
      items: [{ name: "비빔밥", kcal: 600, proteinG: 20 }],
      source: "MANUAL",
    });
    const [meal] = await listMeals(
      db,
      userId,
      kstDayStart("2026-10-18"),
      kstDayStart("2026-10-19"),
    );
    expect(meal.kcal).toBe(600);
    expect(meal.carbsG).toBeNull();
    expect(meal.response).toMatchObject({ baseline: 100, peak: 165, rise: 65 });
  });

  it("체크인·투약 기록에서 위험 신호를 한 번씩만 저장한다", async () => {
    for (const d of ["2026-10-18", "2026-10-19", TODAY])
      await saveCheckIn(db, userId, {
        date: d,
        symptoms: { ...emptySymptoms(), VOMITING: 1 },
        redFlags: d === TODAY ? ["CANNOT_KEEP_FLUIDS"] : [],
        appetite: 3,
      });
    // 9/22 첫 투약 이후 기록이 없어 예정일 여러 번이 지나감
    await saveDose(db, userId, {
      date: "2026-09-22",
      time: "09:00",
      status: "TAKEN",
      doseMg: 0.25,
      site: "ABDOMEN_LEFT",
    });
    expect(await listDoses(db, userId)).toHaveLength(1);
    await refreshAlerts(db, userId, TODAY);
    await refreshAlerts(db, userId, TODAY);
    const rows = await db.careAlert.findMany({ where: { userId } });
    expect(rows.map((r) => r.kind).sort()).toEqual([
      "MISSED_DOSES",
      "PERSISTENT_VOMITING",
      "SEVERE_SYMPTOM",
    ]);
    expect(rows.find((r) => r.kind === "SEVERE_SYMPTOM")?.level).toBe("URGENT");
  });

  it("케어 기록 삭제는 케어 데이터만 지우고, 회원 삭제는 모두 지운다", async () => {
    await db.coachMessage.create({
      data: {
        patientId: userId,
        senderId: userId,
        sender: "PATIENT",
        body: "가상 메시지",
      },
    });
    await deleteCareData(db, userId);
    expect(await db.coachMessage.count({ where: { patientId: userId } })).toBe(
      0,
    );
    expect(await getEnrollment(db, userId)).toBeNull();
    for (const n of await Promise.all([
      db.glucoseReading.count({ where: { userId } }),
      db.mealLog.count({ where: { userId } }),
      db.symptomCheckIn.count({ where: { userId } }),
      db.careAlert.count({ where: { userId } }),
      db.doseLog.count({ where: { userId } }),
    ]))
      expect(n).toBe(0);
    expect(await db.user.count({ where: { id: userId } })).toBe(1);

    const sampleId = await resetCareSample(
      db,
      "scrypt$x$y",
      kstDateTime(TODAY, "15:00").getTime(),
    );
    expect(
      await db.glucoseReading.count({ where: { userId: sampleId } }),
    ).toBeGreaterThan(3000);
    const alerts = await refreshAlerts(db, sampleId, TODAY);
    expect(alerts.map((a) => a.kind)).toContain("LOW_GLUCOSE");
    await db.user.delete({ where: { id: sampleId } });
    expect(await db.glucoseReading.count({ where: { userId: sampleId } })).toBe(
      0,
    );
    expect(await db.careEnrollment.count({ where: { userId: sampleId } })).toBe(
      0,
    );
  });
});
