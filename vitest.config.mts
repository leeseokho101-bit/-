import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
