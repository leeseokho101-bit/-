import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`;

export const PASSWORD = "e2e-password-1";

export async function signup(page: Page, email: string, name = "테스트") {
  await page.goto("/signup");
  await page.fill("#displayName", name);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("form button[type=submit]");
  await page.waitForURL("**/assessment");
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("form button[type=submit]");
  await page.waitForURL("**/dashboard");
}

/** 다음 단계로 저장 이동 */
export async function saveAndNext(page: Page, nextPath: string) {
  await page.click("form button[type=submit]");
  await page.waitForURL(`**${nextPath}`);
}

/** 동의 → 입력 6단계 → 분석 → 결과 화면까지 (가상 값) */
export async function completeAssessment(page: Page) {
  await page.goto("/assessment");
  const consent = page.locator("input[name=consentPrivacy]");
  if (await consent.count()) {
    await consent.check();
    await page.check("input[name=consentHealth]");
  }
  await saveAndNext(page, "/assessment/profile");

  await page.click("text=여성");
  await page.fill("#f-birthDate", "1975-06-15");
  await page.fill("#f-HEIGHT", "160");
  await page.fill("#f-WEIGHT", "70");
  await page.fill("#f-WAIST", "88");
  await saveAndNext(page, "/assessment/checkup");

  await page.fill("#f-SBP", "132");
  await page.fill("#f-DBP", "84");
  await page.fill("#f-FASTING_GLUCOSE", "104");
  await page.fill("#f-HBA1C", "5.8");
  await page.fill("#f-TRIGLYCERIDE", "160");
  await page.fill("#f-HDL", "48");
  await saveAndNext(page, "/assessment/survey");

  await page.fill("#f-exercise-sessionsPerWeek", "1");
  await page.fill("#f-exercise-dailySteps", "4500");
  await page.fill("#f-sleep-avgHours", "6");
  await saveAndNext(page, "/assessment/lifestyle");

  await page.click('fieldset:has-text("단 음료") >> text=주 3~4회');
  await page.click('fieldset:has-text("담배") >> text=피운 적 없음');
  await saveAndNext(page, "/assessment/medications");

  await page.check("input[name=none]");
  await saveAndNext(page, "/assessment/review");

  await page.click("form button[type=submit]");
  await page.waitForURL("**/report", { timeout: 60_000 });
}

/** axe 접근성 검사 (WCAG 2.1 A/AA) — 위반이 없어야 한다 */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.nodes.length}): ${v.help}`,
  );
  expect(summary, `접근성 위반: ${page.url()}`).toEqual([]);
}
