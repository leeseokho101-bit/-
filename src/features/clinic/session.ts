import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { koreaDate } from "@/features/activity/date";
import { getCurrentUser, requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getStaff, type StaffContext } from "./service";

/** 현재 사용자의 의료진 정보 (요청 단위 캐시). 의료진이 아니면 null */
export const getCurrentStaff = cache(async (): Promise<StaffContext | null> => {
  const user = await getCurrentUser();
  return user ? getStaff(db, user.id) : null;
});

/**
 * 의사 대시보드 화면·액션 공통. 로그인하지 않았으면 로그인 화면으로,
 * 의료진 계정이 아니면 화면이 없는 것처럼(404) 처리한다.
 */
export async function requireClinician(returnTo: string): Promise<{
  staff: StaffContext;
  today: string;
  now: number;
}> {
  await requireUser(returnTo);
  const staff = await getCurrentStaff();
  if (!staff) notFound();
  const now = Date.now();
  return { staff, today: koreaDate(new Date(now)), now };
}
