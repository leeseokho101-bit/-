/**
 * DB 연결 문자열 결정 (scripts/db-env.mjs 와 같은 규칙)
 * 직접 설정한 DATABASE_URL 외에 Vercel·Neon 연동이 만드는 이름도 지원한다. 빈 문자열은 미설정으로 본다.
 */
type Env = Record<string, string | undefined>;

const first = (env: Env, keys: string[]) =>
  keys.map((k) => env[k]?.trim()).find((v) => v);

export function resolveDatabaseUrl(env: Env = process.env): string | undefined {
  return first(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
}

export function resolveDirectUrl(env: Env = process.env): string | undefined {
  return (
    first(env, [
      "DIRECT_URL",
      "DATABASE_URL_UNPOOLED",
      "POSTGRES_URL_NON_POOLING",
    ]) ?? resolveDatabaseUrl(env)
  );
}
