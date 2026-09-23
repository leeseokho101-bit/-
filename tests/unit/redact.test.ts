import { describe, expect, it } from "vitest";
import { REDACTED, redact, redactString } from "@/lib/redact";

describe("redact", () => {
  it("민감 키의 값을 마스킹한다", () => {
    const out = redact({
      userId: "u_1",
      email: "someone@example.com",
      passwordHash: "hash",
      metrics: { FASTING_GLUCOSE: 110 },
      birthDate: "1970-01-01",
    }) as Record<string, unknown>;

    expect(out.userId).toBe("u_1");
    expect(out.email).toBe(REDACTED);
    expect(out.passwordHash).toBe(REDACTED);
    expect(out.metrics).toBe(REDACTED);
    expect(out.birthDate).toBe(REDACTED);
  });

  it("중첩 객체와 배열 내부도 마스킹한다", () => {
    const out = redact({ items: [{ ldl: 160, id: "a" }] }) as {
      items: Record<string, unknown>[];
    };
    expect(out.items[0]).toEqual({ ldl: REDACTED, id: "a" });
  });

  it("문자열 속 이메일·전화번호를 치환한다", () => {
    expect(redactString("contact a.b@test.co.kr or 010-1234-5678")).toBe(
      "contact [EMAIL] or [PHONE]",
    );
  });

  it("Error는 name/message만 남기고 message도 마스킹한다", () => {
    expect(redact(new Error("fail for x@y.com"))).toEqual({
      name: "Error",
      message: "fail for [EMAIL]",
    });
  });
});

describe("redact key matching", () => {
  it("짧은 지표 코드는 정확히 일치할 때만 마스킹한다", () => {
    const out = redact({
      alt: 40,
      healthScoreId: "h1",
      lastStep: "checkup",
    }) as Record<string, unknown>;
    expect(out.alt).toBe(REDACTED);
    expect(out.healthScoreId).toBe("h1");
    expect(out.lastStep).toBe("checkup");
  });
});
