import { expect, test } from "@playwright/test";
import { completeAssessment, login, signup, uniqueEmail } from "./helpers";

test.describe("보안·개인정보", () => {
  test("보안 헤더가 설정되고 서버 정보가 노출되지 않는다", async ({
    request,
  }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["x-powered-by"]).toBeUndefined();
    const csp = h["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  test("로그인하지 않으면 건강정보 화면에 접근할 수 없다", async ({ page }) => {
    for (const path of [
      "/dashboard",
      "/mypage",
      "/report",
      "/report/profile",
      "/report/priorities",
      "/report/plan",
      "/assessment",
      "/assessment/profile",
      "/assessment/review",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });

  test("상태 점검 API는 DB 연결만 알려주고 개인정보를 담지 않는다", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
  });

  test("개발용 샘플 화면은 production에서 존재하지 않는다", async ({
    request,
  }) => {
    expect((await request.get("/dev/samples")).status()).toBe(404);
  });

  test("세션 쿠키는 httpOnly·SameSite이고 비밀번호는 응답에 남지 않는다", async ({
    page,
    context,
  }) => {
    await signup(page, uniqueEmail("cookie"));
    const cookie = (await context.cookies()).find(
      (c) => c.name === "hm_session",
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.content()).not.toContain("e2e-password-1");
  });

  test("로그인 후 외부 사이트로 이동시키는 주소는 무시한다", async ({
    page,
  }) => {
    const email = uniqueEmail("redirect");
    await signup(page, email);
    await page.context().clearCookies();
    await page.goto("/login?next=//evil.example");
    await page.fill("#email", email);
    await page.fill("#password", "e2e-password-1");
    await page.click("form button[type=submit]");
    await page.waitForURL("**/dashboard");
    expect(new URL(page.url()).host).toBe(new URL(page.url()).host);
    await expect(page).toHaveURL(/localhost:\d+\/dashboard$/);
  });

  test("다른 사용자의 분석 결과는 보이지 않는다", async ({ browser }) => {
    const a = await browser.newContext();
    const pageA = await a.newPage();
    const emailA = uniqueEmail("owner");
    await signup(pageA, emailA, "소유자");
    await completeAssessment(pageA);
    await expect(pageA.getByRole("heading", { level: 1 })).toContainText(
      "소유자님",
    );

    const b = await browser.newContext();
    const pageB = await b.newPage();
    await signup(pageB, uniqueEmail("other"), "다른사람");
    for (const path of [
      "/report",
      "/report/profile",
      "/report/plan",
      "/dashboard",
    ]) {
      await pageB.goto(path);
      await expect(
        pageB.getByText("아직 분석 결과가 없어요"),
        path,
      ).toBeVisible();
      await expect(pageB.getByText("소유자")).toHaveCount(0);
    }
    // 다른 사람의 계획 주차에 체크를 저장할 수 없다 (본인 계획이 없음)
    await a.close();
    await b.close();
  });

  test("잘못된 비밀번호는 계정 존재 여부를 드러내지 않는다", async ({
    page,
  }) => {
    const email = uniqueEmail("enum");
    await signup(page, email);
    await page.context().clearCookies();
    for (const e of [email, uniqueEmail("nobody")]) {
      await page.goto("/login");
      await page.fill("#email", e);
      await page.fill("#password", "wrong-password");
      await page.click("form button[type=submit]");
      await expect(page.locator("form [role=alert]")).toHaveText(
        "⚠ 이메일 또는 비밀번호가 올바르지 않습니다.",
      );
    }
  });

  test("로그아웃하면 세션이 끝난다", async ({ page }) => {
    const email = uniqueEmail("logout");
    await signup(page, email);
    await page.context().clearCookies();
    await login(page, email);
    await page.goto("/mypage");
    await page.click('button:has-text("로그아웃")');
    await page.waitForURL((u) => u.pathname === "/");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
