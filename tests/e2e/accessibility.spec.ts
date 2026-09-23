import { test } from "@playwright/test";
import { expectAccessible, signup, uniqueEmail } from "./helpers";

test.describe("접근성 (WCAG 2.1 AA, axe)", () => {
  test("공개 화면", async ({ page }) => {
    for (const path of ["/", "/about", "/login", "/signup"]) {
      await page.goto(path);
      await expectAccessible(page);
    }
  });

  test("동의·입력 단계 화면", async ({ page }) => {
    await signup(page, uniqueEmail("a11y"));
    await expectAccessible(page); // 동의 화면
    await page.check("input[name=consentPrivacy]");
    await page.check("input[name=consentHealth]");
    await page.click("form button[type=submit]");
    await page.waitForURL("**/assessment/profile");
    for (const step of [
      "profile",
      "checkup",
      "survey",
      "lifestyle",
      "medications",
      "review",
    ]) {
      await page.goto(`/assessment/${step}`);
      await expectAccessible(page);
    }
  });
});
