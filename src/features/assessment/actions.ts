"use server";

import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import type { z } from "zod";
import {
  calculateBmi,
  METRICS,
  type MetricCode,
} from "@/domain/health-snapshot/metrics";
import {
  parseSurveyAnswers,
  SURVEY_SCHEMA_VERSION,
  surveyAnswersSchema,
  type SurveyAnswers,
} from "@/domain/health-snapshot/survey";
import { runAnalysis } from "@/features/analysis/run";
import { echoValues, toFieldErrors, type FormState } from "@/lib/form-state";
import {
  assessmentStepPath,
  getAssessmentStep,
  type AssessmentStepSlug,
} from "@/lib/routes";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { formDataToObject } from "./form-data";
import {
  CHECKUP_INPUT_CODES,
  checkupFormSchema,
  exerciseSleepFormSchema,
  lifestyleFormSchema,
  medicationsFormSchema,
  profileFormSchema,
} from "./schemas";
import { requireDraftAssessment } from "./service";

type Tx = Prisma.TransactionClient;
type Ctx = { userId: string; assessmentId: string };

/**
 * 입력 단계 공통 처리: 가드 → 검증 → 트랜잭션 저장 → 다음 단계로 이동
 * 검증 실패 시 오류와 입력값을 돌려준다.
 */
async function runStep<S extends z.ZodType>(
  slug: AssessmentStepSlug,
  formData: FormData,
  schema: S,
  persist: (tx: Tx, data: z.output<S>, ctx: Ctx) => Promise<void>,
): Promise<FormState> {
  const { user, assessmentId } = await requireDraftAssessment(
    assessmentStepPath(slug),
  );
  const parsed = schema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      message: "입력 내용을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData),
    };
  }
  try {
    await db.$transaction((tx) =>
      persist(tx, parsed.data, { userId: user.id, assessmentId }),
    );
  } catch (error) {
    logger.error("assessment step save failed", {
      step: slug,
      assessmentId,
      error,
    });
    return {
      message: "저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  redirect(getAssessmentStep(slug).nextPath);
}

async function setMetric(
  tx: Tx,
  assessmentId: string,
  metric: MetricCode,
  value: number | undefined | null,
) {
  if (value === undefined || value === null) {
    await tx.measurement.deleteMany({ where: { assessmentId, metric } });
    return;
  }
  const data = { value, unit: METRICS[metric].unit, source: "MANUAL" as const };
  await tx.measurement.upsert({
    where: { assessmentId_metric: { assessmentId, metric } },
    create: { assessmentId, metric, ...data },
    update: data,
  });
}

async function mergeSurvey(
  tx: Tx,
  assessmentId: string,
  patch: Partial<SurveyAnswers>,
) {
  const current = await tx.surveyResponse.findUnique({
    where: { assessmentId },
    select: { answers: true },
  });
  const answers = surveyAnswersSchema.parse({
    ...parseSurveyAnswers(current?.answers),
    ...patch,
  });
  await tx.surveyResponse.upsert({
    where: { assessmentId },
    create: { assessmentId, schemaVersion: SURVEY_SCHEMA_VERSION, answers },
    update: { schemaVersion: SURVEY_SCHEMA_VERSION, answers },
  });
}

export async function saveProfile(_prev: FormState, formData: FormData) {
  return runStep(
    "profile",
    formData,
    profileFormSchema,
    async (tx, d, { userId, assessmentId }) => {
      await tx.user.update({
        where: { id: userId },
        data: { displayName: d.displayName },
      });
      await tx.profile.upsert({
        where: { userId },
        create: { userId, sex: d.sex, birthDate: d.birthDate },
        update: { sex: d.sex, birthDate: d.birthDate },
      });
      await setMetric(tx, assessmentId, "HEIGHT", d.HEIGHT);
      await setMetric(tx, assessmentId, "WEIGHT", d.WEIGHT);
      await setMetric(
        tx,
        assessmentId,
        "BMI",
        calculateBmi(d.HEIGHT, d.WEIGHT),
      );
      await setMetric(tx, assessmentId, "WAIST", d.WAIST);
    },
  );
}

export async function saveCheckup(_prev: FormState, formData: FormData) {
  return runStep(
    "checkup",
    formData,
    checkupFormSchema,
    async (tx, d, { assessmentId }) => {
      await tx.assessment.update({
        where: { id: assessmentId },
        data: {
          checkupDate: d.checkupDate
            ? new Date(`${d.checkupDate}T00:00:00Z`)
            : null,
        },
      });
      for (const code of CHECKUP_INPUT_CODES) {
        await setMetric(tx, assessmentId, code, d[code]);
      }
    },
  );
}

export async function saveExerciseSleep(_prev: FormState, formData: FormData) {
  return runStep(
    "survey",
    formData,
    exerciseSleepFormSchema,
    async (tx, d, { assessmentId }) => {
      await mergeSurvey(tx, assessmentId, {
        exercise: d.exercise,
        sleep: d.sleep,
      });
    },
  );
}

export async function saveLifestyle(_prev: FormState, formData: FormData) {
  return runStep(
    "lifestyle",
    formData,
    lifestyleFormSchema,
    async (tx, d, { assessmentId }) => {
      await mergeSurvey(tx, assessmentId, d);
    },
  );
}

export async function saveMedications(_prev: FormState, formData: FormData) {
  return runStep(
    "medications",
    formData,
    medicationsFormSchema,
    async (tx, d, { assessmentId }) => {
      await tx.medication.deleteMany({ where: { assessmentId } });
      if (d.meds.length > 0) {
        await tx.medication.createMany({
          data: d.meds.map((m) => ({
            assessmentId,
            name: m.name!,
            purpose: m.purpose || null,
            frequency: m.frequency || null,
          })),
        });
      }
      await mergeSurvey(tx, assessmentId, {
        medicationsNone: d.none ? true : d.meds.length > 0 ? false : undefined,
      });
    },
  );
}

/** 입력 확인 → 분석 요청. 최소 입력(기본정보)이 없으면 해당 단계로 안내한다. */
export async function submitAssessment(_prev: FormState): Promise<FormState> {
  const { user, assessmentId } = await requireDraftAssessment(
    assessmentStepPath("review"),
  );
  const [profile, bodyCount] = await Promise.all([
    db.profile.findUnique({
      where: { userId: user.id },
      select: { userId: true },
    }),
    db.measurement.count({
      where: { assessmentId, metric: { in: ["HEIGHT", "WEIGHT"] } },
    }),
  ]);
  if (!profile || bodyCount < 2) {
    return { message: "기본정보(성별·생년월일·키·체중)를 먼저 입력해 주세요." };
  }
  await db.assessment.update({
    where: { id: assessmentId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  try {
    await db.$transaction((tx) => runAnalysis(tx, assessmentId));
  } catch (error) {
    await db.assessment.update({
      where: { id: assessmentId },
      data: { status: "DRAFT" },
    });
    logger.error("analysis failed", { userId: user.id, assessmentId, error });
    return {
      message: "분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  logger.info("assessment analyzed", { userId: user.id, assessmentId });
  redirect(getAssessmentStep("review").nextPath);
}
