import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/features/auth/schema";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("평문을 저장하지 않고, 올바른 비밀번호만 검증한다", async () => {
    const hash = await hashPassword("correct-horse");
    expect(hash).not.toContain("correct-horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse", hash)).toBe(true);
    expect(await verifyPassword("wrong-horse", hash)).toBe(false);
  });

  it("같은 비밀번호도 매번 다른 해시(salt)를 만든다", async () => {
    expect(await hashPassword("same-pass")).not.toBe(
      await hashPassword("same-pass"),
    );
  });

  it("형식이 잘못된 저장값은 거부한다", async () => {
    expect(await verifyPassword("x", "plain-text")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("같은 사이트 상대 경로만 허용한다", () => {
    expect(safeRedirectPath("/report", "/")).toBe("/report");
    expect(safeRedirectPath("//evil.com", "/")).toBe("/");
    expect(safeRedirectPath("https://evil.com", "/")).toBe("/");
    expect(safeRedirectPath("/\\evil.com", "/")).toBe("/");
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
  });
});

describe("auth schemas", () => {
  it("이메일을 소문자·공백 제거로 정규화한다", () => {
    const r = loginSchema.parse({
      email: "  User@Example.COM ",
      password: "x",
    });
    expect(r.email).toBe("user@example.com");
  });

  it("짧은 비밀번호는 거부한다", () => {
    const r = signupSchema.safeParse({
      displayName: "a",
      email: "a@b.co",
      password: "short",
    });
    expect(r.success).toBe(false);
  });
});
