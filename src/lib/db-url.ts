/**
 * DB 연결 문자열 결정 (scripts/db-env.mjs 와 같은 규칙)
 * 직접 설정한 DATABASE_URL 외에 Vercel·Neon 연동이 만드는 이름(접두사 포함, 예: h1_DATABASE_URL)도 지원한다.
 * 빈 문자열은 미설정으로 본다.
 */
type Env = Record<string, string | undefined>;

function lookup(env: Env, name: string): string | undefined {
  const direct = env[name]?.trim();
  if (direct) return direct;
  const prefixed = Object.keys(env)
    .filter(
      (k) =>
        k.endsWith(`_${name}`) &&
        /^[A-Za-z0-9]+$/.test(k.slice(0, -name.length - 1)),
    )
    .sort();
  for (const k of prefixed) {
    const v = env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

const first = (env: Env, names: string[]) =>
  names.map((n) => lookup(env, n)).find((v) => v);

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
