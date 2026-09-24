/**
 * Vercel 배포 빌드: 환경변수 점검 → DB 마이그레이션 → Next.js 빌드
 * DB 연결 문자열은 scripts/db-env.mjs 규칙으로 정해 Prisma에 넘긴다 (값은 출력하지 않음).
 */
import { spawnSync } from "node:child_process";
import { resolveDatabaseUrl, resolveDirectUrl } from "./db-env.mjs";

function run(cmd, args, env = process.env) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node", ["scripts/check-deploy-env.mjs"]);

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(),
  DIRECT_URL: resolveDirectUrl(),
};
console.log("→ DB 마이그레이션 (prisma migrate deploy)");
run("npx", ["prisma", "migrate", "deploy"], env);
console.log("→ 앱 빌드 (next build)");
run("npx", ["next", "build"], env);
