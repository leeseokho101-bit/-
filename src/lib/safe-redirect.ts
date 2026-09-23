/** 로그인 후 이동 경로: 같은 사이트의 상대 경로만 허용 (open redirect 방지) */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return fallback;
  return value;
}
