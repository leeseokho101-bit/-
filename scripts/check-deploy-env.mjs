/**
 * 배포 빌드 전 환경변수 점검 (값은 출력하지 않는다)
 * vercel-build 첫 단계에서 실행되어, 설정 누락을 알아보기 쉬운 메시지로 알려준다.
 * 통과하면 0, 문제가 있으면 1로 끝난다. (scripts/deploy-build.mjs 에서도 사용)
 */
import { resolveDatabaseUrl, resolveDirectUrl } from "./db-env.mjs";

const problems = [];

function checkPostgresUrl(name, raw, { pooled }) {
  if (!raw) {
    return problems.push(
      `${name}: 설정되지 않았거나 비어 있습니다. Vercel → Storage에서 Neon DB를 이 프로젝트에 연결해 주세요.`,
    );
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return problems.push(
      `${name}: URL 형식이 아닙니다. Neon의 연결 문자열 전체를 붙여 넣어 주세요.`,
    );
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    problems.push(`${name}: postgresql:// 로 시작해야 합니다.`);
  }
  // ALLOW_LOCAL_DB=1: 로컬에서 배포 빌드를 시험할 때만 사용
  if (
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    process.env.ALLOW_LOCAL_DB !== "1"
  ) {
    problems.push(
      `${name}: 로컬 DB 주소입니다. Neon 연결 문자열을 넣어 주세요.`,
    );
  }
  const isPooler = url.hostname.includes("-pooler");
  if (url.hostname.endsWith("neon.tech")) {
    if (pooled && !isPooler)
      problems.push(
        `${name}: Neon의 pooled 연결(호스트에 -pooler)을 권장합니다.`,
      );
    if (!pooled && isPooler)
      problems.push(
        `${name}: 마이그레이션에는 -pooler 가 없는 direct 연결을 넣어 주세요.`,
      );
  }
}

checkPostgresUrl("DATABASE_URL", resolveDatabaseUrl(), { pooled: true });
checkPostgresUrl(
  "DIRECT_URL (또는 DATABASE_URL_UNPOOLED)",
  resolveDirectUrl(),
  { pooled: false },
);
if ((process.env.SESSION_SECRET ?? "").length < 32) {
  problems.push("SESSION_SECRET: 32자 이상이어야 합니다.");
}
console.log(
  `ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "설정됨 (AI 설명 사용)" : "없음 (기본 설명 사용)"}`,
);

// pooled 권장 경고는 빌드를 막지 않는다
const blocking = problems.filter((p) => !p.includes("권장"));
for (const p of problems)
  console.log(`${blocking.includes(p) ? "✗" : "!"} ${p}`);
if (blocking.length) {
  console.log(
    "\n환경변수를 Vercel → Settings → Environment Variables에서 확인한 뒤 다시 배포해 주세요. (docs/DEPLOYMENT.md)",
  );
  process.exit(1);
}
console.log("✓ 배포 환경변수 점검 통과");
