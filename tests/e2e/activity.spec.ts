import { expect, test } from "@playwright/test";
import {
  completeAssessment,
  expectAccessible,
  signup,
  uniqueEmail,
} from "./helpers";

test("걸음수·운동을 기록하면 운동 반영 예상 생체나이가 보인다", async ({
  page,
}) => {
  await signup(page, uniqueEmail("activity"));
  await completeAssessment(page);

  await page.goto("/activity");
  await expect(
    page.getByText("첫 기록을 저장하면 예상 생체나이가 여기에 나타나요"),
  ).toBeVisible();

  await page.fill("#activity-steps", "9000");
  await page.selectOption("select[name='sessions.0.type']", "CYCLING");
  await page.selectOption("select[name='sessions.0.intensity']", "MODERATE");
  await page.fill("input[name='sessions.0.minutes']", "40");
  await page.click("text=+ 운동 추가");
  await page.selectOption("select[name='sessions.1.type']", "STRENGTH");
  await page.selectOption("select[name='sessions.1.intensity']", "VIGOROUS");
  await page.fill("input[name='sessions.1.minutes']", "20");
  await page.click("form button[type=submit]");

  await expect(page.getByRole("status")).toContainText("저장했어요");
  // 저장 후에도 입력한 운동이 화면에 그대로 남는다 (폼 초기화로 선택 값이 지워지지 않음)
  await expect(page.locator("select[name='sessions.0.type']")).toHaveValue(
    "CYCLING",
  );
  await expect(page.locator("select[name='sessions.1.intensity']")).toHaveValue(
    "VIGOROUS",
  );
  await expect(page.getByText("지금까지 기록 반영")).toBeVisible();
  await expect(page.getByText("지금처럼 12주 계속하면")).toBeVisible();
  await expect(page.getByText("9,000보").first()).toBeVisible();
  await expectAccessible(page);

  // 일부만 입력한 운동은 오류
  await page.click("text=+ 운동 추가");
  await page.selectOption("select[name='sessions.2.type']", "SWIMMING");
  await page.click("form button[type=submit]");
  await expect(page.getByText("입력 내용을 확인해 주세요.")).toBeVisible();

  // 대시보드·생체나이 화면에서도 보인다
  await page.goto("/dashboard");
  await expect(page.getByText("오늘 기록 고치기")).toBeVisible();
  await page.goto("/report/bio-age");
  await expect(page.getByText("걸음수·운동으로 바뀌는 생체나이")).toBeVisible();
  await expect(page.getByText("지금처럼 12주 계속하면")).toBeVisible();
});
