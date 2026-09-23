import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 운영 DB에서 실행되지 않도록 방어
if (process.env.NODE_ENV === "production") {
  throw new Error("DB integration tests must not run in production");
}

const db = new PrismaClient();
// 테스트 전용 가상 계정 (실제 개인정보 아님)
const TEST_EMAIL = "schema-test@example.invalid";

async function cleanup() {
  await db.user.deleteMany({ where: { email: TEST_EMAIL } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("database schema", () => {
  it("사용자 → 분석 → 입력·결과·12주 계획 전체를 저장하고 조회한다", async () => {
    const user = await db.user.create({
      data: {
        email: TEST_EMAIL,
        displayName: "테스트",
        isSample: true,
        profile: { create: { sex: "MALE", birthDate: new Date("1970-01-01") } },
        assessments: {
          create: {
            status: "ANALYZED",
            measurements: {
              create: [
                { metric: "HEIGHT", value: 170, unit: "cm" },
                { metric: "WEIGHT", value: 72.5, unit: "kg" },
                { metric: "HBA1C", value: 5.8, unit: "%" },
              ],
            },
            survey: {
              create: { schemaVersion: "survey-v1", answers: { exercise: {} } },
            },
            medications: { create: [{ name: "가상약", purpose: "테스트" }] },
            result: {
              create: {
                engineVersion: "rules-v1",
                inputHash: "hash",
                domains: [],
                priorities: [],
              },
            },
            plan: {
              create: {
                startDate: new Date("2026-01-05"),
                weeks: {
                  create: {
                    weekNumber: 1,
                    phase: "FOUNDATION",
                    goal: "목표",
                    actions: ["걷기"],
                    checks: [{ id: "c1", label: "걷기" }],
                    checkIns: {
                      create: { completed: { c1: true }, weight: 72.1 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      include: {
        assessments: {
          include: {
            measurements: true,
            survey: true,
            medications: true,
            result: true,
            plan: { include: { weeks: { include: { checkIns: true } } } },
          },
        },
      },
    });

    const a = user.assessments[0];
    expect(a.measurements).toHaveLength(3);
    expect(
      a.measurements.find((m) => m.metric === "HBA1C")?.value.toString(),
    ).toBe("5.8");
    expect(a.measurements[0].source).toBe("MANUAL");
    expect(a.survey?.schemaVersion).toBe("survey-v1");
    expect(a.plan?.weeks[0].checkIns[0].weight?.toString()).toBe("72.1");
  });

  it("같은 분석에 같은 지표를 두 번 저장할 수 없다", async () => {
    const a = await db.assessment.findFirstOrThrow({
      where: { user: { email: TEST_EMAIL } },
    });
    await expect(
      db.measurement.create({
        data: { assessmentId: a.id, metric: "HEIGHT", value: 171, unit: "cm" },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("사용자를 삭제하면 모든 건강정보가 함께 삭제된다", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { email: TEST_EMAIL },
    });
    const a = await db.assessment.findFirstOrThrow({
      where: { userId: user.id },
    });
    const plan = await db.carePlan.findUniqueOrThrow({
      where: { assessmentId: a.id },
      include: { weeks: true },
    });
    const weekIds = plan.weeks.map((w) => w.id);

    await db.user.delete({ where: { id: user.id } });

    const [profiles, assessments, measurements, surveys, meds, results, plans] =
      await Promise.all([
        db.profile.count({ where: { userId: user.id } }),
        db.assessment.count({ where: { userId: user.id } }),
        db.measurement.count({ where: { assessmentId: a.id } }),
        db.surveyResponse.count({ where: { assessmentId: a.id } }),
        db.medication.count({ where: { assessmentId: a.id } }),
        db.analysisResult.count({ where: { assessmentId: a.id } }),
        db.carePlan.count({ where: { assessmentId: a.id } }),
      ]);
    expect([
      profiles,
      assessments,
      measurements,
      surveys,
      meds,
      results,
      plans,
    ]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await db.planWeek.count({ where: { planId: plan.id } })).toBe(0);
    expect(
      await db.weeklyCheckIn.count({ where: { weekId: { in: weekIds } } }),
    ).toBe(0);
  });
});
