import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// DB 통합 테스트 전용 설정 (로컬/CI의 개발용 DB에서만 실행)
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // server-only는 React Server 환경 밖에서 import 시 예외를 던지므로 테스트에서는 빈 모듈로 대체
      "server-only": fileURLToPath(
        new URL("./tests/stubs/empty.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
