import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl, resolveDirectUrl } from "@/lib/db-url";
// 배포 빌드 스크립트와 같은 규칙인지 확인
import * as script from "../../scripts/db-env.mjs";

const cases: [
  string,
  Record<string, string>,
  string | undefined,
  string | undefined,
][] = [
  [
    "직접 설정",
    { DATABASE_URL: "pooled", DIRECT_URL: "direct" },
    "pooled",
    "direct",
  ],
  [
    "빈 값은 미설정",
    { DATABASE_URL: "", DIRECT_URL: " " },
    undefined,
    undefined,
  ],
  [
    "Vercel·Neon 연동 이름",
    {
      DATABASE_URL: "",
      DIRECT_URL: "",
      POSTGRES_PRISMA_URL: "p",
      DATABASE_URL_UNPOOLED: "u",
    },
    "p",
    "u",
  ],
  ["direct가 없으면 앱 연결 사용", { DATABASE_URL: "only" }, "only", "only"],
  [
    "연동 접두사(h1_) — 기존 빈 변수가 있어도 인식",
    {
      DATABASE_URL: "",
      DIRECT_URL: "",
      h1_DATABASE_URL: "pooled",
      h1_DATABASE_URL_UNPOOLED: "direct",
    },
    "pooled",
    "direct",
  ],
  [
    "접두사 없는 이름이 우선",
    { DATABASE_URL: "main", h1_DATABASE_URL: "other", DIRECT_URL: "d" },
    "main",
    "d",
  ],
  // 비슷한 이름이지만 접두사 규칙이 아닌 것은 무시 (예: MY_APP_DATABASE_URL 의 접두사는 MY_APP)
  [
    "밑줄이 든 접두사는 무시",
    { MY_APP_DATABASE_URL: "x" },
    undefined,
    undefined,
  ],
];

describe("DB 연결 문자열 결정", () => {
  it.each(cases)("%s", (_name, env, db, direct) => {
    expect(resolveDatabaseUrl(env)).toBe(db);
    expect(resolveDirectUrl(env)).toBe(direct);
    expect(script.resolveDatabaseUrl(env as NodeJS.ProcessEnv)).toBe(db);
    expect(script.resolveDirectUrl(env as NodeJS.ProcessEnv)).toBe(direct);
  });
});
