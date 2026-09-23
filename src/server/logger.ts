import "server-only";
import { redact, redactString } from "@/lib/redact";

type Level = "debug" | "info" | "warn" | "error";

/**
 * 모든 서버 로그는 이 logger를 사용합니다. (console.* 직접 사용 금지)
 * 전달된 context는 redact()로 마스킹되어 개인정보·건강정보가 남지 않습니다.
 * 식별이 필요할 때는 userId/assessmentId 같은 내부 ID만 사용하세요.
 */
function write(
  level: Level,
  message: string,
  context?: Record<string, unknown>,
) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: redactString(message),
    ...(context ? { ctx: redact(context) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    write("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    write("error", msg, ctx),
};
