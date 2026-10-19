import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { analyze } from "@/domain/analysis/engine";
import { calculateBioAge } from "@/domain/bio-age/engine";
import type { BioAgeInput } from "@/domain/bio-age/types";
import { buildHealthSnapshot, canonicalJson } from "@/domain/analysis/snapshot";
import type { AnalysisOutput } from "@/domain/analysis/types";
import type { MetricCode } from "@/domain/health-snapshot/metrics";
import { parseSurveyAnswers } from "@/domain/health-snapshot/survey";

type Db = PrismaClient | Prisma.TransactionClient;

export class AnalysisInputError extends Error {}

/** 저장된 입력 → 분석 엔진·생체나이 엔진 입력 (분석 실행과 운동 반영 예상이 같은 입력을 쓰도록 공유) */
export async function loadAnalysisInputs(db: Db, assessmentId: string) {
  const a = await db.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      checkupDate: true,
      submittedAt: true,
      createdAt: true,
      user: { select: { profile: { select: { sex: true, birthDate: true } } } },
      measurements: { select: { metric: true, value: true } },
      survey: { select: { answers: true } },
      medications: {
        select: { purpose: true, drugCode: true, dailyTablets: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const profile = a.user.profile;
  if (!profile) throw new AnalysisInputError("profile is required");

  const snapshot = buildHealthSnapshot({
    sex: profile.sex,
    birthDate: profile.birthDate,
    referenceDate: a.checkupDate ?? a.submittedAt ?? a.createdAt,
    metrics: Object.fromEntries(
      a.measurements.map((m) => [m.metric, m.value.toNumber()]),
    ) as Partial<Record<MetricCode, number>>,
    survey: parseSurveyAnswers(a.survey?.answers),
    medicationPurposes: a.medications.map((m) => m.purpose),
  });
  // 생체나이: 같은 지표 + 복용약 성분·용량
  const bioAgeInput: BioAgeInput = {
    sex: snapshot.demographics.sex,
    age: snapshot.demographics.age,
    metrics: snapshot.metrics,
    medications: a.medications.map((m) => ({
      purpose: m.purpose,
      drugCode: m.drugCode,
      dailyTablets: m.dailyTablets?.toNumber() ?? null,
    })),
  };
  return { snapshot, bioAgeInput };
}

/**
 * 저장된 입력으로 분석 엔진을 실행하고 결과를 저장한다.
 * 같은 입력이면 inputHash가 같고 결과도 같다 (엔진 버전이 같을 때).
 */
export async function runAnalysis(
  db: Db,
  assessmentId: string,
): Promise<{ output: AnalysisOutput; inputHash: string }> {
  const { snapshot, bioAgeInput } = await loadAnalysisInputs(db, assessmentId);
  const output = analyze(snapshot);
  // 결과 JSON 안에 생체나이 자체 버전을 함께 저장
  const bioAge = calculateBioAge(bioAgeInput);
  const inputHash = createHash("sha256")
    .update(`${output.engineVersion}|${canonicalJson(snapshot)}`)
    .digest("hex");

  const data = {
    engineVersion: output.engineVersion,
    inputHash,
    domains: output.domains as unknown as Prisma.InputJsonValue,
    priorities: output.priorities as unknown as Prisma.InputJsonValue,
    bioAge: bioAge as unknown as Prisma.InputJsonValue,
  };
  await db.analysisResult.upsert({
    where: { assessmentId },
    create: { assessmentId, ...data },
    update: { ...data, narrative: Prisma.DbNull, llmModel: null },
  });
  await db.assessment.update({
    where: { id: assessmentId },
    data: { status: "ANALYZED" },
  });
  return { output, inputHash };
}
