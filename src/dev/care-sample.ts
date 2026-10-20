/**
 * GLP-1 케어 가상 환자 (개발·데모 전용). 모든 값은 규칙으로 만든 가상 데이터다.
 * server-only를 import하지 않아 seed 스크립트에서도 쓸 수 있다.
 *
 * 시나리오: 터제파타이드 2.5mg로 시작해 5주째 5mg으로 증량(담당 의사 결정), 투약 직후
 * 1~2일 식욕 감소·메스꺼움, 증량 직후 메스꺼움 증가, 혈당·식후 상승폭 점차 감소,
 * 최근 7일 새벽 저혈당 구간 2번(위험 신호 안내 데모).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { CARE_CONSENT_VERSION } from "@/content/care";
import { INJECTION_SITES } from "@/domain/glp1/dosing";
import { mealTotals, type MealItem } from "@/domain/glp1/meal";
import {
  triageCheckIn,
  emptySymptoms,
  type Severity,
} from "@/domain/glp1/symptoms";
import {
  addDaysIso,
  daysBetween,
  HOUR_MS,
  kstDateTime,
  kstDayStart,
  MINUTE_MS,
} from "@/domain/glp1/time";
import { assertSampleEnvironment } from "./seed-sample";

export const CARE_SAMPLE = {
  email: "sample-care@example.invalid",
  displayName: "케어 가상 환자",
  clinicCode: "DEMO-0001",
  clinicName: "가상내과의원(데모)",
} as const;

/** 결정적 의사난수 (mulberry32) */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEALS: {
  type: "BREAKFAST" | "LUNCH" | "DINNER";
  time: string;
  items: MealItem[];
}[] = [
  {
    type: "BREAKFAST",
    time: "07:40",
    items: [
      { name: "현미밥 반 공기", kcal: 150, carbsG: 33, proteinG: 3 },
      { name: "계란프라이 2개", kcal: 180, carbsG: 1, proteinG: 12 },
    ],
  },
  {
    type: "LUNCH",
    time: "12:20",
    items: [
      { name: "김치찌개", kcal: 250, carbsG: 12, proteinG: 15 },
      { name: "흰쌀밥 1공기", kcal: 300, carbsG: 66, proteinG: 5 },
    ],
  },
  {
    type: "DINNER",
    time: "18:50",
    items: [
      { name: "고등어구이", kcal: 260, carbsG: 0, proteinG: 22 },
      { name: "잡곡밥 2/3공기", kcal: 200, carbsG: 44, proteinG: 4 },
      { name: "시금치나물", kcal: 40, carbsG: 4, proteinG: 2 },
    ],
  },
];

/** 가상 환자를 지우고 다시 만든다. 반환: 사용자 ID */
export async function resetCareSample(
  db: PrismaClient,
  passwordHash: string,
  now: number = Date.now(),
): Promise<string> {
  assertSampleEnvironment();
  const rand = rng(20261020);
  const today = new Date(now + 9 * HOUR_MS).toISOString().slice(0, 10);
  const start = addDaysIso(today, -34);
  const escalation = addDaysIso(start, 28);

  const clinic = await db.clinic.upsert({
    where: { code: CARE_SAMPLE.clinicCode },
    create: {
      code: CARE_SAMPLE.clinicCode,
      name: CARE_SAMPLE.clinicName,
      isSample: true,
    },
    update: {},
  });
  await db.user.deleteMany({
    where: { email: CARE_SAMPLE.email, isSample: true },
  });
  const user = await db.user.create({
    data: {
      email: CARE_SAMPLE.email,
      displayName: CARE_SAMPLE.displayName,
      passwordHash,
      isSample: true,
      consentAt: new Date(now),
      consentVersion: "sample",
      careEnrollment: {
        create: {
          clinicId: clinic.id,
          linkedAt: new Date(now),
          drugCode: "TIRZEPATIDE_WEEKLY",
          currentDoseMg: 5,
          doseSince: new Date(`${escalation}T00:00:00Z`),
          startDate: new Date(`${start}T00:00:00Z`),
          consentVersion: CARE_CONSENT_VERSION,
          consentAt: new Date(now),
          shareWithClinic: true,
        },
      },
    },
  });
  const userId = user.id;

  // 투약: 매주 같은 요일 09:00, 부위 순환
  const doseDays: string[] = [];
  for (let d = start; d <= today; d = addDaysIso(d, 7)) doseDays.push(d);
  await db.doseLog.createMany({
    data: doseDays.map((d, i) => ({
      userId,
      takenAt: kstDateTime(d, "09:00"),
      status: "TAKEN" as const,
      doseMg: d >= escalation ? 5 : 2.5,
      site: INJECTION_SITES[i % INJECTION_SITES.length],
    })),
  });
  const daysSinceDose = (day: string) =>
    daysBetween([...doseDays].reverse().find((d) => d <= day) ?? start, day);
  /** 0(시작 전) → 1(효과 최대)로 서서히 */
  const effect = (day: string) => {
    const n = daysBetween(start, day);
    if (n < 0) return 0;
    return Math.min(1, 0.35 + n * 0.02 + (day >= escalation ? 0.15 : 0));
  };

  // 혈당: 시작 7일 전부터 지금까지 15분 간격
  const readings: {
    userId: string;
    measuredAt: Date;
    mgdl: number;
    source: "SAMPLE";
  }[] = [];
  const lowDays = [addDaysIso(today, -5), addDaysIso(today, -2)];
  for (
    let t = kstDayStart(addDaysIso(start, -7));
    t <= now;
    t += 15 * MINUTE_MS
  ) {
    const day = new Date(t + 9 * HOUR_MS).toISOString().slice(0, 10);
    const hour = ((t + 9 * HOUR_MS) % (24 * HOUR_MS)) / HOUR_MS;
    const e = effect(day);
    let v = 128 - 22 * e + 6 * Math.sin(((hour - 4) / 24) * 2 * Math.PI);
    for (const m of MEALS) {
      const mh = Number(m.time.slice(0, 2)) + Number(m.time.slice(3)) / 60;
      const dt = hour - mh;
      if (dt > 0 && dt < 3)
        v += (70 - 35 * e) * Math.exp(-((dt - 0.75) ** 2) / 0.35);
    }
    if (lowDays.includes(day) && hour >= 3 && hour < 3.75) v = 62;
    v += (rand() - 0.5) * 10;
    readings.push({
      userId,
      measuredAt: new Date(t),
      mgdl: Math.round(v),
      source: "SAMPLE",
    });
  }
  for (let i = 0; i < readings.length; i += 2000)
    await db.glucoseReading.createMany({ data: readings.slice(i, i + 2000) });

  // 식사·체크인: 시작일부터 어제까지 + 오늘은 지난 끼니만
  const meals: Prisma.MealLogCreateManyInput[] = [];
  const checkIns: Prisma.SymptomCheckInCreateManyInput[] = [];
  for (let d = start; d <= today; d = addDaysIso(d, 1)) {
    const since = daysSinceDose(d);
    const afterEscalation = d >= escalation && daysBetween(escalation, d) < 10;
    for (const m of MEALS) {
      const at = kstDateTime(d, m.time);
      if (at.getTime() > now) continue;
      // 식욕이 줄어 밥 양이 조금씩 줄어든다
      const scale = since <= 1 ? 0.7 : 1;
      const items = m.items.map((i) => ({
        ...i,
        kcal: Math.round((i.kcal ?? 0) * scale),
        carbsG: Math.round((i.carbsG ?? 0) * scale),
      }));
      meals.push({
        userId,
        eatenAt: at,
        mealType: m.type,
        items: items as unknown as Prisma.InputJsonValue,
        ...mealTotals(items),
        source: "MANUAL",
      });
    }
    if (d === today) continue;
    const nausea = (
      since <= 1
        ? afterEscalation
          ? 2
          : 1
        : afterEscalation && since <= 3
          ? 1
          : 0
    ) as Severity;
    const symptoms = {
      ...emptySymptoms(),
      NAUSEA: nausea,
      CONSTIPATION: (since >= 3 && since <= 4 ? 1 : 0) as Severity,
      FATIGUE: (since === 1 ? 1 : 0) as Severity,
    };
    const n = daysBetween(start, d);
    checkIns.push({
      userId,
      date: new Date(`${d}T00:00:00Z`),
      symptoms,
      redFlags: [],
      appetite: Math.max(
        1,
        Math.min(
          10,
          (since <= 1 ? 3 : since <= 3 ? 5 : 7) + (rand() < 0.3 ? 1 : 0),
        ),
      ),
      weightKg:
        n % 3 === 0
          ? Math.round((92 - n * 0.12 + (rand() - 0.5) * 0.4) * 10) / 10
          : null,
      triage: triageCheckIn({ symptoms, redFlags: [] }).level,
    });
  }
  await db.mealLog.createMany({ data: meals });
  await db.symptomCheckIn.createMany({ data: checkIns });
  return userId;
}
