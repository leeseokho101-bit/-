/**
 * 로그에 개인정보·건강정보가 출력되지 않도록 마스킹합니다.
 * - 민감 키: 값 전체를 "[REDACTED]" 로 치환
 * - 문자열 값: 이메일/전화번호 패턴을 치환
 */
// 키 이름에 포함되면 마스킹하는 단어 (부분 일치)
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|apikey|api_key|authorization|cookie|email|name|birth|phone|address|gender|height|weight|waist|glucose|hba1c|cholesterol|triglyceride|creatinine|measurement|metric|survey|answer|medication|drug)/i;

// 짧은 지표 코드는 오탐을 줄이기 위해 키 전체가 일치할 때만 마스킹
const SENSITIVE_EXACT_KEYS = new Set([
  "sex",
  "bmi",
  "sbp",
  "dbp",
  "ldl",
  "hdl",
  "tg",
  "ast",
  "alt",
  "ggt",
  "egfr",
  "value",
]);

function isSensitiveKey(key: string): boolean {
  return (
    SENSITIVE_EXACT_KEYS.has(key.toLowerCase()) ||
    SENSITIVE_KEY_PATTERN.test(key)
  );
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_PATTERN = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g;

export const REDACTED = "[REDACTED]";

export function redactString(input: string): string {
  return input
    .replace(EMAIL_PATTERN, "[EMAIL]")
    .replace(PHONE_PATTERN, "[PHONE]");
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}
