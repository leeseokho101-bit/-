import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kstDateTime } from "@/domain/glp1/time";
import { saveEnrollment, saveMeal } from "@/features/care/service";
import { getStaff, listClinicPatients } from "@/features/clinic/service";
import {
  autoAssignCoach,
  claimPatient,
  coachInbox,
  getAssignedPatient,
  getCoach,
  listThread,
  markRead,
  referToClinic,
  sendCoachMessage,
  sendPatientMessage,
  unreadForPatient,
  weekSummary,
} from "@/features/coaching/service";

if (process.env.NODE_ENV === "production") {
  throw new Error("DB integration tests must not run in production");
}

const db = new PrismaClient();
// 테스트 전용 가상 계정·의원 (실제 정보 아님)
const TAG = "coaching-test";
const CODE = "CO-TEST";
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

const enroll = (share: boolean) => ({
  clinicCode: CODE,
  drugCode: "TIRZEPATIDE_WEEKLY" as const,
  doseMg: 2.5,
  startDate: "2026-10-01",
  consentService: "on" as const,
  shareWithClinic: share,
  allowResearch: false,
  allowPharmaStats: false,
});

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await db.clinic.deleteMany({ where: { code: CODE } });
  const clinic = await db.clinic.create({
    data: { code: CODE, name: "코칭테스트의원", isSample: true },
  });
  await db.clinicStaff.create({
    data: { userId: await user("doctor"), clinicId: clinic.id },
  });
  await db.coach.create({
    data: { userId: await user("coachA"), specialty: "NUTRITION" },
  });
  await db.coach.create({
    data: { userId: await user("coachB"), specialty: "EXERCISE" },
  });
  await saveEnrollment(db, await user("p1"), enroll(true), TODAY);
  await saveEnrollment(db, await user("p2"), enroll(false), TODAY);
});

afterAll(async () => {
  await db.coachAccessLog.deleteMany({
    where: { coachUserId: { in: [ids.coachA, ids.coachB] } },
  });
  await db.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await db.clinic.deleteMany({ where: { code: CODE } });
  await db.$disconnect();
});

describe("코칭 센터 (DB)", () => {
  it("자동 배정은 담당 환자가 적은 코치에게, 이미 배정됐으면 그대로", async () => {
    // 다른 데이터의 코치가 있을 수 있어, 이 테스트의 두 코치끼리의 균형만 확인
    await db.careEnrollment.update({
      where: { userId: ids.p1 },
      data: { coachId: ids.coachA },
    });
    expect(await autoAssignCoach(db, ids.p1)).toBe(ids.coachA);
    const assigned = await autoAssignCoach(db, ids.p2);
    expect(assigned).not.toBeNull();
    await db.careEnrollment.update({
      where: { userId: ids.p2 },
      data: { coachId: null },
    });
    // 미배정 환자는 먼저 맡은 코치만
    const a = (await getCoach(db, ids.coachA))!;
    const b = (await getCoach(db, ids.coachB))!;
    expect(await claimPatient(db, b, ids.p2)).toBe(true);
    expect(await claimPatient(db, a, ids.p2)).toBe(false);
  });

  it("코치는 자기 담당 환자만 본다", async () => {
    const a = (await getCoach(db, ids.coachA))!;
    expect(await getAssignedPatient(db, a, ids.p1)).not.toBeNull();
    expect(await getAssignedPatient(db, a, ids.p2)).toBeNull();
    expect(await getCoach(db, ids.p1)).toBeNull();
  });

  it("대화: 약 문의 표시, 읽음 처리, 범위 밖 표현은 저장하지 않음", async () => {
    const a = (await getCoach(db, ids.coachA))!;
    await sendPatientMessage(db, ids.p1, "다음 주에 용량 올려도 될까요?");
    let inbox = await coachInbox(db, a, TODAY, NOW);
    const row = inbox.rows.find((r) => r.patientId === ids.p1)!;
    expect(row).toMatchObject({
      unread: 1,
      medicationQuestion: true,
      coachMessagesThisWeek: 0,
    });

    expect(
      await sendCoachMessage(db, a, ids.p1, "속이 괜찮으면 증량해 보세요"),
    ).toEqual({
      ok: false,
      reason: "dose-change",
    });
    expect(
      await sendCoachMessage(db, a, ids.p1, "단백질을 먼저 드셔 보세요."),
    ).toEqual({ ok: true });
    await markRead(db, ids.p1, "COACH");
    expect(await unreadForPatient(db, ids.p1)).toBe(1);
    await markRead(db, ids.p1, "PATIENT");
    expect(await unreadForPatient(db, ids.p1)).toBe(0);
    const thread = await listThread(db, ids.p1);
    expect(thread.map((m) => m.sender)).toEqual(["PATIENT", "COACH"]);
    inbox = await coachInbox(db, a, TODAY, Date.now());
    expect(inbox.rows.find((r) => r.patientId === ids.p1)).toMatchObject({
      unread: 0,
    });
  });

  it("주간 요약은 최근 7일 기록으로", async () => {
    await saveMeal(db, ids.p1, {
      date: TODAY,
      time: "12:00",
      mealType: "LUNCH",
      items: [{ name: "닭가슴살샐러드", proteinG: 30 }],
      source: "MANUAL",
    });
    const a = (await getCoach(db, ids.coachA))!;
    const p = (await getAssignedPatient(db, a, ids.p1))!;
    const s = await weekSummary(db, p, TODAY, NOW);
    expect(s).toMatchObject({
      mealCount: 1,
      avgProteinPerDay: 30,
      checkInDays: 0,
    });
  });

  it("의원 확인 요청은 공유 동의 환자면 의사 대시보드에 보인다", async () => {
    const a = (await getCoach(db, ids.coachA))!;
    const b = (await getCoach(db, ids.coachB))!;
    const p1 = (await getAssignedPatient(db, a, ids.p1))!;
    expect(await referToClinic(db, a, p1, "약·용량 문의")).toEqual({
      visibleToClinic: true,
    });
    const p2 = (await getAssignedPatient(db, b, ids.p2))!;
    expect(await referToClinic(db, b, p2, "기타")).toEqual({
      visibleToClinic: false,
    });

    const staff = (await getStaff(db, ids.doctor))!;
    const { alerts } = await listClinicPatients(
      db,
      staff.clinicId,
      TODAY,
      Date.now(),
    );
    const referral = alerts.find((x) => x.kind === "COACH_REFERRAL");
    expect(referral).toMatchObject({
      patientId: ids.p1,
      detail: "약·용량 문의",
    });
    expect(alerts.some((x) => x.patientId === ids.p2)).toBe(false);
    // 환자 대화에 안내가 남는다
    expect((await listThread(db, ids.p1)).at(-1)?.sender).toBe("SYSTEM");
  });
});
