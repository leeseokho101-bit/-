/**
 * DB 연결 문자열 결정 — 직접 설정한 이름과 Vercel·Neon 연동이 만드는 이름을 모두 지원
 *   앱(pooled):         DATABASE_URL → POSTGRES_PRISMA_URL → POSTGRES_URL
 *   마이그레이션(direct): DIRECT_URL → DATABASE_URL_UNPOOLED → POSTGRES_URL_NON_POOLING → (앱 연결)
 * 빈 문자열은 설정되지 않은 것으로 본다. (src/lib/db-url.ts 와 같은 규칙)
 */
const first = (env, keys) => keys.map((k) => env[k]?.trim()).find((v) => v);

export function resolveDatabaseUrl(env = process.env) {
  return first(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
}

export function resolveDirectUrl(env = process.env) {
  return (
    first(env, [
      "DIRECT_URL",
      "DATABASE_URL_UNPOOLED",
      "POSTGRES_URL_NON_POOLING",
    ]) ?? resolveDatabaseUrl(env)
  );
}
