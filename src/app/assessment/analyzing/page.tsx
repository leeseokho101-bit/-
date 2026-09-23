import { redirect } from "next/navigation";
import { ensureNarrative } from "@/features/analysis/narrative";
import { routes } from "@/lib/routes";
import { getNarrativeProvider } from "@/server/ai/provider";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "분석 중 | 입체적 건강분석" };

/**
 * 분석 결과 설명(AI 또는 템플릿)을 준비한 뒤 결과 화면으로 이동한다.
 * 준비하는 동안에는 loading.tsx가 표시된다.
 */
export default async function AnalyzingPage() {
  const user = await requireUser(routes.report);
  const latest = await db.assessment.findFirst({
    where: { userId: user.id, status: "ANALYZED" },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });
  if (!latest) redirect(routes.assessment);
  await ensureNarrative(db, latest.id, getNarrativeProvider());
  redirect(routes.report);
}
