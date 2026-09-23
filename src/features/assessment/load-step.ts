import "server-only";
import {
  assessmentStepPath,
  getAssessmentStep,
  type AssessmentStepSlug,
} from "@/lib/routes";
import { loadAssessmentInputs } from "./queries";
import { requireDraftAssessment } from "./service";

/** 입력 단계 페이지 공통: 가드 + 기존 입력값 + 이전 경로 */
export async function loadStep(slug: AssessmentStepSlug) {
  const { user, assessmentId } = await requireDraftAssessment(
    assessmentStepPath(slug),
  );
  const inputs = await loadAssessmentInputs(user.id, assessmentId);
  return { inputs, prevHref: getAssessmentStep(slug).prevPath };
}
