import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { koreaDate } from "@/features/activity/date";
import { getCurrentUser, requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getCoach, type CoachContext } from "./service";

export const getCurrentCoach = cache(async (): Promise<CoachContext | null> => {
  const user = await getCurrentUser();
  return user ? getCoach(db, user.id) : null;
});

/** 코칭 센터 공통: 코치 계정이 아니면 없는 화면처럼(404) */
export async function requireCoach(returnTo: string): Promise<{
  coach: CoachContext;
  today: string;
  now: number;
}> {
  await requireUser(returnTo);
  const coach = await getCurrentCoach();
  if (!coach) notFound();
  const now = Date.now();
  return { coach, today: koreaDate(new Date(now)), now };
}
