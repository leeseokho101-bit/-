import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { routes } from "@/lib/routes";

const COOKIE_NAME = "hm_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 세션 생성: 쿠키에는 원본 토큰, DB에는 해시만 저장 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token)
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(COOKIE_NAME);
}

export type CurrentUser = {
  id: string;
  displayName: string;
  consentAt: Date | null;
  isSample: boolean;
};

/** 현재 로그인 사용자 (요청 단위 캐시). 없으면 null */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          displayName: true,
          consentAt: true,
          isSample: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt)
    return null;
  const { id, displayName, consentAt, isSample } = session.user;
  return { id, displayName, consentAt, isSample };
});

/** 로그인이 필요한 페이지/액션에서 사용. 비로그인 시 로그인 화면으로 이동 */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      returnTo
        ? `${routes.login}?next=${encodeURIComponent(returnTo)}`
        : routes.login,
    );
  }
  return user;
}
