import "server-only";
import type { MetricCode } from "@/domain/health-snapshot/metrics";
import {
  parseSurveyAnswers,
  type SurveyAnswers,
} from "@/domain/health-snapshot/survey";
import { db } from "@/server/db";

export type AssessmentInputs = {
  displayName: string;
  profile: { sex: "MALE" | "FEMALE"; birthDate: Date } | null;
  checkupDate: Date | null;
  metrics: Partial<Record<MetricCode, number>>;
  survey: SurveyAnswers;
  hasSurvey: boolean;
  medications: {
    name: string;
    purpose: string | null;
    frequency: string | null;
  }[];
};

/** 입력 단계 기본값·확인 화면용 데이터 (소유자 검증은 호출 측 requireDraftAssessment에서) */
export async function loadAssessmentInputs(
  userId: string,
  assessmentId: string,
): Promise<AssessmentInputs> {
  const [user, assessment] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        displayName: true,
        profile: { select: { sex: true, birthDate: true } },
      },
    }),
    db.assessment.findFirstOrThrow({
      where: { id: assessmentId, userId },
      select: {
        checkupDate: true,
        measurements: { select: { metric: true, value: true } },
        survey: { select: { answers: true } },
        medications: {
          select: { name: true, purpose: true, frequency: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  return {
    displayName: user.displayName,
    profile: user.profile,
    checkupDate: assessment.checkupDate,
    metrics: Object.fromEntries(
      assessment.measurements.map((m) => [m.metric, m.value.toNumber()]),
    ) as AssessmentInputs["metrics"],
    survey: parseSurveyAnswers(assessment.survey?.answers),
    hasSurvey: !!assessment.survey,
    medications: assessment.medications,
  };
}
