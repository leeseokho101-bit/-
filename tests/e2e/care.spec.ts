import { expect, test } from "@playwright/test";
import { expectAccessible, signup, uniqueEmail } from "./helpers";

/** CGM 내보내기 형식의 가상 데이터: 오늘 새벽 저혈당 구간 포함 */
function cgmCsv(): string {
  const now = new Date(Date.now() + 9 * 3600_000);
  const day = now.toISOString().slice(0, 10);
  const rows = [
    "가상 기기 내보내기",
    "Device Timestamp,Historic Glucose mg/dL",
  ];
  for (let m = 0; m < 6 * 60; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const v = m >= 120 && m <= 165 ? 50 : 110;
    rows.push(`${day} ${hh}:${mm},${v}`);
  }
  return rows.join("\n");
}

test("GLP-1 케어: 등록 → 투약 → 체크인 위험 신호 → CGM 파일 → 식사 → 홈 알림", async ({
  page,
}) => {
  await signup(page, uniqueEmail("care"));

  // 등록 전에는 등록 화면으로
  await page.goto("/care");
  await page.waitForURL("**/care/start");
  await expectAccessible(page);

  // 필수 동의 없이 제출하면 오류
  await page.selectOption("#drugCode", "TIRZEPATIDE_WEEKLY");
  await page.selectOption("#doseMg", "2.5");
  await page.click("form button[type=submit]");
  await expect(
    page.getByText("서비스 이용 동의(필수)에 체크해 주세요."),
  ).toBeVisible();
  await page.check("input[name=consentService]");
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/care$/);
  await expect(page.getByText("오늘이 투약일이에요")).toBeVisible();
  await expectAccessible(page);

  // 투약 기록 (추천 부위가 미리 골라져 있다)
  await page.goto("/care/dose");
  await expect(
    page.locator("input[name=site][value=ABDOMEN_LEFT]"),
  ).toBeChecked();
  await page.getByRole("button", { name: "기록하기" }).click();
  await expect(page.getByRole("status")).toContainText("투약을 기록했어요");
  await expect(page.getByText("7일 뒤 투약일이에요")).toBeVisible();
  await expectAccessible(page);

  // 체크인: 위험 신호 → 바로 진료 안내
  await page.goto("/care/check-in");
  await page.click('fieldset:has-text("메스꺼움") >> text=보통');
  await page.check("input[name='redFlag.CANNOT_KEEP_FLUIDS']");
  await page.getByRole("button", { name: "체크인 저장" }).click();
  await expect(
    page.getByRole("heading", { name: "바로 진료를 받으세요" }),
  ).toBeVisible();
  await expect(page.getByText("한 번에 조금씩, 천천히")).toBeVisible();
  await expectAccessible(page);

  // CGM 파일 올리기 → 지표
  await page.goto("/care/glucose");
  await page.setInputFiles("#cgm-file", {
    name: "cgm.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(cgmCsv()),
  });
  await page.getByRole("button", { name: "파일 올리기" }).click();
  await expect(page.getByRole("status")).toContainText(
    "혈당 24개를 저장했어요",
  );
  await page.reload();
  await expect(page.getByText("목표 범위 안 시간").first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: /하루 혈당 그래프/ }),
  ).toBeVisible();
  await expectAccessible(page);

  // 식사 직접 기록
  await page.goto("/care/meals");
  await page.fill("input[name='items.0.name']", "두부샐러드");
  await page.fill("input[name='items.0.proteinG']", "18");
  await page.getByRole("button", { name: "식사 기록하기" }).click();
  await expect(page.getByRole("status")).toContainText("식사를 기록했어요");
  await expect(page.getByText("두부샐러드")).toBeVisible();
  await expectAccessible(page);

  // 홈: 위험 신호 안내 (체크인 + 심한 저혈당)
  await page.goto("/care");
  const alert = page.locator("section[role=alert]");
  await expect(alert).toContainText("바로 진료가 필요한 신호");
  await expect(alert).toContainText("54mg/dL 아래로 15분 넘게");

  // 반응 타임라인·설정
  await page.goto("/care/response");
  await expect(page.getByText("2.5mg")).toBeVisible();
  await expectAccessible(page);
  await page.goto("/care/settings");
  await page.click("text=케어 기록 삭제");
  await page.check("input[name=confirm]");
  await page.getByRole("button", { name: "케어 기록 삭제" }).click();
  await page.waitForURL("**/care/start");
});

test("캘린더 알림 파일은 로그인한 등록 사용자만 받을 수 있다", async ({
  request,
}) => {
  const res = await request.get("/care/dose/reminder");
  expect(res.status()).toBe(401);
});
