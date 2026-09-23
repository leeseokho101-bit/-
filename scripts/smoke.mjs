/**
 * 배포 후 점검 (읽기 전용 — 계정을 만들거나 데이터를 바꾸지 않는다)
 *   npm run smoke -- https://your-app.vercel.app
 */
const base = (process.argv[2] ?? process.env.SMOKE_URL ?? "").replace(
  /\/$/,
  "",
);
if (!base.startsWith("http")) {
  console.error("사용법: npm run smoke -- https://배포주소");
  process.exit(2);
}

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", `${name} — ${e.message}`]);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const get = (path, init) => fetch(base + path, { redirect: "manual", ...init });

await check("상태 점검 /api/health (DB 연결)", async () => {
  const r = await get("/api/health");
  const body = await r.json();
  assert(
    r.status === 200 && body.db === "ok",
    `status ${r.status} ${JSON.stringify(body)}`,
  );
});

await check("랜딩 페이지 200", async () => {
  const r = await get("/");
  assert(r.status === 200, `status ${r.status}`);
  assert((await r.text()).includes("입체적 건강분석"), "서비스명이 없음");
});

await check("보안 헤더", async () => {
  const h = (await get("/")).headers;
  assert(
    h.get("content-security-policy")?.includes("default-src 'self'"),
    "CSP 없음",
  );
  assert(
    !h.get("content-security-policy")?.includes("unsafe-eval"),
    "CSP에 unsafe-eval",
  );
  assert(h.get("x-frame-options") === "DENY", "X-Frame-Options");
  assert(h.get("x-content-type-options") === "nosniff", "nosniff");
  assert(!h.get("x-powered-by"), "X-Powered-By 노출");
  if (base.startsWith("https://")) {
    assert(h.get("strict-transport-security"), "HSTS 없음");
  }
});

await check("로그인 없이 대시보드 접근 불가", async () => {
  const r = await get("/dashboard");
  const loc = r.headers.get("location") ?? "";
  const body = r.status === 200 ? await r.text() : "";
  assert(
    (r.status >= 300 && r.status < 400 && loc.includes("/login")) ||
      body.includes("NEXT_REDIRECT"),
    `status ${r.status} location ${loc}`,
  );
});

await check("개발용 샘플 화면 비활성 (404)", async () => {
  const r = await get("/dev/samples");
  assert(r.status === 404, `status ${r.status}`);
});

for (const [s, name] of results)
  console.log(`${s === "PASS" ? "✓" : "✗"} ${name}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(failed ? `\n${failed}개 실패` : "\n모든 점검 통과");
process.exit(failed ? 1 : 0);
