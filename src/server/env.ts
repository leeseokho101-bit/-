import "server-only";
import { z } from "zod";
import { resolveDatabaseUrl } from "@/lib/db-url";

/**
 * 서버 전용 환경변수. 클라이언트 번들에 포함되지 않도록 `server-only`로 보호합니다.
 * API Key 등 비밀값은 반드시 이 모듈을 통해서만 읽습니다.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  ANTHROPIC_API_KEY: z.string().trim().optional().default(""),
  // 빈 값으로 등록된 경우에도 기본 모델 사용
  LLM_MODEL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    z.string().default("claude-opus-5"),
  ),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    ...process.env,
    DATABASE_URL: resolveDatabaseUrl(),
  });
  if (!parsed.success) {
    // 값 자체는 출력하지 않고, 누락/오류가 있는 키 이름만 알려줍니다.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment variables: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}

/** 개발/테스트 환경 전용 기능(샘플 데이터 로드 등)의 가드 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}
