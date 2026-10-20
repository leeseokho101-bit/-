import "server-only";
import { redirect } from "next/navigation";
import { koreaDate } from "@/features/activity/date";
import { routes } from "@/lib/routes";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getEnrollment, type Enrollment } from "./service";

/** 케어 화면·액션 공통: 로그인 + 프로그램 등록. 등록 전이면 등록 화면으로 */
export async function requireEnrollment(returnTo: string): Promise<{
  user: CurrentUser;
  enrollment: Enrollment;
  today: string;
  /** 요청 시각 (ms) — 화면 렌더링 중 Date.now()를 직접 부르지 않도록 여기서 정한다 */
  now: number;
}> {
  const user = await requireUser(returnTo);
  const enrollment = await getEnrollment(db, user.id);
  if (!enrollment) redirect(routes.careStart);
  const now = Date.now();
  return { user, enrollment, today: koreaDate(new Date(now)), now };
}
