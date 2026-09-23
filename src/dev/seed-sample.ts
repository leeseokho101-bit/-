/**
 * 가상 사용자 생성/초기화 (seed 스크립트와 개발용 화면에서 공통 사용)
 * server-only를 import하지 않아 tsx seed 스크립트에서도 실행 가능하다.
 */
import type { PrismaClient } from "@prisma/client";
import {
  calculateBmi,
  METRICS,
  type MetricCode,
} from "@/domain/health-snapshot/metrics";
import {
  SURVEY_SCHEMA_VERSION,
  surveyAnswersSchema,
} from "@/domain/health-snapshot/survey";
import type { SampleUser } from "./samples";

export function assertSampleEnvironment() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Sample data is disabled in production");
  }
}

/**
 * 샘플 사용자를 지우고 다시 만든다. 입력이 모두 채워진 "작성 중(DRAFT)" 분석을 1개 갖는다.
 * @returns 생성된 사용자 ID
 */
export async function resetSampleUser(
  db: PrismaClient,
  sample: SampleUser,
  passwordHash: string,
): Promise<string> {
  assertSampleEnvironment();
  const survey = surveyAnswersSchema.parse(sample.survey);
  const { HEIGHT, WEIGHT } = sample.metrics;
  const bmi = HEIGHT && WEIGHT ? calculateBmi(HEIGHT, WEIGHT) : null;
  const metrics = Object.entries({
    ...sample.metrics,
    ...(bmi ? { BMI: bmi } : {}),
  }) as [MetricCode, number][];

  return db.$transaction(async (tx) => {
    // isSample 계정만 삭제 대상 (실제 사용자 보호)
    await tx.user.deleteMany({
      where: { email: sample.email, isSample: true },
    });
    const user = await tx.user.create({
      data: {
        email: sample.email,
        displayName: sample.displayName,
        passwordHash,
        isSample: true,
        consentAt: new Date(),
        consentVersion: "sample",
        profile: {
          create: {
            sex: sample.sex,
            birthDate: new Date(`${sample.birthDate}T00:00:00Z`),
          },
        },
        assessments: {
          create: {
            status: "DRAFT",
            checkupDate: new Date(`${sample.checkupDate}T00:00:00Z`),
            measurements: {
              create: metrics.map(([metric, value]) => ({
                metric,
                value,
                unit: METRICS[metric].unit,
                source: "MANUAL",
              })),
            },
            survey: {
              create: { schemaVersion: SURVEY_SCHEMA_VERSION, answers: survey },
            },
            medications: {
              create: sample.medications.map((m) => ({
                name: m.name,
                purpose: m.purpose ?? null,
                frequency: m.frequency ?? null,
              })),
            },
          },
        },
      },
      select: { id: true },
    });
    return user.id;
  });
}
