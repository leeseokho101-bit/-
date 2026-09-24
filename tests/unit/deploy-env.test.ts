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
];

describe("DB 연결 문자열 결정", () => {
  it.each(cases)("%s", (_name, env, db, direct) => {
    expect(resolveDatabaseUrl(env)).toBe(db);
    expect(resolveDirectUrl(env)).toBe(direct);
    expect(script.resolveDatabaseUrl(env as NodeJS.ProcessEnv)).toBe(db);
    expect(script.resolveDirectUrl(env as NodeJS.ProcessEnv)).toBe(direct);
  });
});
