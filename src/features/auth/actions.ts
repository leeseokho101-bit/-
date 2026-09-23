"use server";

import { redirect } from "next/navigation";
import { echoValues, toFieldErrors, type FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, deleteSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { loginSchema, signupSchema } from "./schema";

const INVALID_LOGIN = "이메일 또는 비밀번호가 올바르지 않습니다.";

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData, ["password"]),
    };
  }
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, deletedAt: true },
  });
  const ok =
    !!user?.passwordHash &&
    !user.deletedAt &&
    (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !ok) {
    return {
      message: INVALID_LOGIN,
      values: echoValues(formData, ["password"]),
    };
  }
  await createSession(user.id);
  logger.info("login", { userId: user.id });
  redirect(safeRedirectPath(formData.get("next"), routes.dashboard));
}

export async function signup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData, ["password"]),
    };
  }
  const exists = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (exists) {
    return {
      fieldErrors: { email: "이미 가입된 이메일입니다. 로그인해 주세요." },
      values: echoValues(formData, ["password"]),
    };
  }
  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true },
  });
  await createSession(user.id);
  logger.info("signup", { userId: user.id });
  redirect(safeRedirectPath(formData.get("next"), routes.assessment));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect(routes.home);
}
