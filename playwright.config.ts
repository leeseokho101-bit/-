import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3300);

/**
 * E2E 테스트: production 빌드로 실제 사용자 흐름을 검증한다.
 * 실행 전 `npm run build` 필요 (CI에서는 build 단계 후 실행). 개발 DB를 사용한다.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ko-KR",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    // 모바일 우선 (375px 폭)
    viewport: { width: 375, height: 800 },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
