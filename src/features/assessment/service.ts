import "server-only";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";

/** 사용자의 작성 중(DRAFT) 분석. 여러 개면 가장 최근 것 */
export async function findDraftAssessment(userId: string) {
  return db.assessment.findFirst({
    where: { userId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

export async function getOrCreateDraftAssessment(userId: string) {
  return (
    (await findDraftAssessment(userId)) ??
    db.assessment.create({ data: { userId }, select: { id: true } })
  );
}

/**
 * 입력 단계 페이지·액션 공통 가드: 로그인 + 동의 + 작성 중인 분석이 있어야 한다.
 * 분석 ID는 URL이 아니라 세션 사용자 기준으로 조회한다.
 */
export async function requireDraftAssessment(
  returnTo: string,
): Promise<{ user: CurrentUser; assessmentId: string }> {
  const user = await requireUser(returnTo);
  if (!user.consentAt) redirect(routes.assessment);
  const draft = await findDraftAssessment(user.id);
  if (!draft) redirect(routes.assessment);
  return { user, assessmentId: draft.id };
}
