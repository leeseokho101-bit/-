import { expect, test } from "@playwright/test";
import {
  completeAssessment,
  expectAccessible,
  signup,
  uniqueEmail,
} from "./helpers";

test.describe("핵심 사용자 흐름", () => {
  test("가입 → 입력 → 분석 → 결과 → 계획 → 체크 → 대시보드 → 삭제", async ({
    page,
  }) => {
    const visited: string[] = [];
    // 콘솔 오류(CSP 위반·hydration 오류 등)가 없어야 한다
    const consoleErrors: string[] = [];
    page.on(
      "console",
      (m) => m.type() === "error" && consoleErrors.push(m.text()),
    );
    page.on("pageerror", (e) => consoleErrors.push(e.message));
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) visited.push(f.url());
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "내 건강을 하나씩 보는 것이 아니라, 전체적으로 분석합니다.",
    );
    await expectAccessible(page);

    await signup(page, uniqueEmail("journey"), "여정");
    await completeAssessment(page);

    // 결과 요약
    await expect(
      page.getByRole("heading", { name: "건강 한눈에 보기" }),
    ).toBeVisible();
    await expect(page.locator("main ol > li")).toHaveCount(3);
    await expect(page.getByText("의학적 진단이 아닙니다")).toBeVisible();
    await expectAccessible(page);

    // 프로파일 10개 카드
    await page.goto("/report/profile");
    await expect(page.locator("article")).toHaveCount(10);
    await expectAccessible(page);

    // 우선순위
    await page.goto("/report/priorities");
    await expect(page.getByText("판단 근거").first()).toBeVisible();
    await expectAccessible(page);

    // 12주 계획 + 이번 주 체크
    await page.goto("/report/plan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "1주차 진행 중",
    );
    const form = page
      .locator("form")
      .filter({ has: page.locator('input[name=weekNumber][value="1"]') })
      .first();
    await form.locator("input[type=checkbox]").first().check();
    await form.locator("input[name=weight]").fill("69.5");
    await form.locator("button[type=submit]").click();
    await expect(form.getByRole("status")).toContainText("실천율");
    await expectAccessible(page);

    // 대시보드 반영
    await page.goto("/dashboard");
    await expect(page.getByText("−0.5 kg")).toBeVisible();
    await expect(page.getByRole("img", { name: /1주차 · \d+%/ })).toBeVisible();
    await expectAccessible(page);

    // 마이페이지 → 데이터 삭제
    await page.goto("/mypage");
    await expectAccessible(page);
    await page.click('summary:has-text("내 데이터 삭제")');
    await page.check("input[name=confirm]");
    await page.click('button:has-text("내 데이터 전체 삭제")');
    await page.waitForURL("**/?deleted=1");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    expect(consoleErrors).toEqual([]);

    // 건강정보가 URL에 노출되지 않는다 (허용 query: next, deleted)
    for (const url of visited) {
      const params = [...new URL(url).searchParams.keys()];
      expect(
        params.filter((k) => !["next", "deleted"].includes(k)),
        url,
      ).toEqual([]);
      expect(url).not.toMatch(/\d{2,3}\s*mg|kg|HBA1C|GLUCOSE|weight/i);
    }
  });

  test("입력 오류는 항목별로 안내하고, 입력값을 유지한다", async ({ page }) => {
    await signup(page, uniqueEmail("validation"));
    await page.check("input[name=consentPrivacy]");
    await page.check("input[name=consentHealth]");
    await page.click("form button[type=submit]");
    await page.waitForURL("**/assessment/profile");

    await page.fill("#f-HEIGHT", "1720");
    await page.click("form button[type=submit]");
    await expect(
      page.getByText("120~220 cm 사이로 입력해 주세요."),
    ).toBeVisible();
    await expect(page.getByText("성별을 선택해 주세요.")).toBeVisible();
    await expect(page.locator("#f-HEIGHT")).toHaveValue("1720");
    await expect(page.locator("#f-HEIGHT")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expectAccessible(page);
  });
});
