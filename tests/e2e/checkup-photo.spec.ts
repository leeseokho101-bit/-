import { expect, test } from "@playwright/test";
import { saveAndNext, signup, uniqueEmail } from "./helpers";

// E2E 서버는 ANTHROPIC_API_KEY 없이 실행된다 → 사진 판독은 꺼지고 직접 입력으로 안내
test("API Key가 없으면 사진 판독을 숨기고 직접 입력으로 안내한다", async ({
  page,
}) => {
  await signup(page, uniqueEmail("photo"));
  await page.check("input[name=consentPrivacy]");
  await page.check("input[name=consentHealth]");
  await saveAndNext(page, "/assessment/profile");
  await page.click("text=여성");
  await page.fill("#f-birthDate", "1975-06-15");
  await page.fill("#f-HEIGHT", "160");
  await page.fill("#f-WEIGHT", "60");
  await saveAndNext(page, "/assessment/checkup");

  await expect(page.getByText("결과표 사진으로 입력")).toHaveCount(0);

  await page.goto("/assessment/checkup/photo");
  await expect(
    page.getByText("지금은 사진 판독을 사용할 수 없어요"),
  ).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page.click("text=직접 입력하기");
  await expect(page).toHaveURL(/\/assessment\/checkup$/);
});
