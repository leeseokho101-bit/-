"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { deleteSession, requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

/**
 * 내 데이터 전체 삭제 (삭제권). 사용자를 삭제하면 기본정보·검진·문진·복용약·분석 결과·
 * 12주 계획·세션이 모두 함께 삭제된다 (onDelete: Cascade).
 */
export async function deleteMyData(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser(routes.mypage);
  if (formData.get("confirm") !== "on") {
    return { message: "삭제 안내를 확인하고 체크해 주세요." };
  }
  await db.user.delete({ where: { id: user.id } });
  await deleteSession();
  logger.info("user data deleted", { userId: user.id });
  redirect(`${routes.home}?deleted=1`);
}
