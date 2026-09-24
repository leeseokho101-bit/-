/**
 * DB 연결 문자열 결정 — 직접 설정한 이름과 Vercel·Neon 연동이 만드는 이름을 모두 지원
 *   앱(pooled):         DATABASE_URL → POSTGRES_PRISMA_URL → POSTGRES_URL
 *   마이그레이션(direct): DIRECT_URL → DATABASE_URL_UNPOOLED → POSTGRES_URL_NON_POOLING → (앱 연결)
 * 연동을 연결할 때 접두사를 붙인 경우(예: h1_DATABASE_URL)도 인식한다 (접두사 없는 이름 우선).
 * 빈 문자열은 설정되지 않은 것으로 본다. (src/lib/db-url.ts 와 같은 규칙)
 */
function lookup(env, name) {
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

const first = (env, names) => names.map((n) => lookup(env, n)).find((v) => v);

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
