import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { koreaDate } from "@/features/activity/date";
import { getCurrentUser, requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getPharmaMember, type PharmaContext } from "./service";

export const getCurrentPharma = cache(
  async (): Promise<PharmaContext | null> => {
    const user = await getCurrentUser();
    return user ? getPharmaMember(db, user.id) : null;
  },
);

/** 제약사 포털 공통: 제약사 계정이 아니면 없는 화면처럼(404) */
export async function requirePharma(returnTo: string): Promise<{
  member: PharmaContext;
  today: string;
}> {
  await requireUser(returnTo);
  const member = await getCurrentPharma();
  if (!member) notFound();
  return { member, today: koreaDate() };
}
