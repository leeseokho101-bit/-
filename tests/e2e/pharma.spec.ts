import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser } from "@playwright/test";
import { expectAccessible, PASSWORD, signup, uniqueEmail } from "./helpers";

// 제약사 계정은 화면에서 만들 수 없어 (운영 스크립트 전용) 테스트에서 DB로 권한을 붙인다
if (existsSync(".env")) process.loadEnvFile(".env");
const db = new PrismaClient();
const ORG = `E2E-제약-${Date.now()}`;

test.afterAll(async () => {
  await db.pharmaOrg.deleteMany({ where: { name: ORG } });
  await db.$disconnect();
});

const newPage = async (browser: Browser) =>
  (await browser.newContext()).newPage();

test("제약사 포털: 담당자는 집계 화면을 보고, 다른 사용자는 볼 수 없다", async ({
  browser,
}) => {
  const email = uniqueEmail("pharma");
  const page = await newPage(browser);
  await signup(page, email, "제약담당");
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const org = await db.pharmaOrg.create({
    data: { name: ORG, drugCodes: ["TIRZEPATIDE_WEEKLY"] },
  });
  await db.pharmaMember.create({ data: { userId: user.id, orgId: org.id } });

  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("form button[type=submit]");
  await page.waitForURL("**/pharma");
  await expect(
    page.getByRole("heading", { name: "채널 현황", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "개별 의원의 처방량·환자 수와 개별 환자 정보는 보여주지 않아요",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "지속 복용 분석 (자사 제품)" }),
  ).toBeVisible();
  await expectAccessible(page);

  const other = await newPage(browser);
  await signup(other, uniqueEmail("not-pharma"));
  expect((await other.goto("/pharma"))?.status()).toBe(404);
});

test("환자가 치료 중단을 기록하면 투약 알림이 멈추고, 다시 시작할 수 있다", async ({
  page,
}) => {
  await signup(page, uniqueEmail("stop"));
  await page.goto("/care/start");
  await page.selectOption("#drugCode", "TIRZEPATIDE_WEEKLY");
  await page.selectOption("#doseMg", "2.5");
  await page.check("input[name=consentService]");
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/care$/);

  await page.goto("/care/dose");
  await page.click("text=치료를 그만두셨나요?");
  await page.selectOption("#stop-reason", "SIDE_EFFECTS");
  await page.getByRole("button", { name: "치료 중단 기록" }).click();
  await expect(page.getByRole("status").last()).toContainText(
    "치료 중단을 기록했어요",
  );
  await expectAccessible(page);
  await page.goto("/care");
  await expect(page.getByText("치료를 그만둔 것으로 기록했어요")).toBeVisible();

  await page.goto("/care/dose");
  await page.getByRole("button", { name: "다시 시작했어요" }).click();
  // 다시 시작하면 중단 영역이 접히고 "그만두셨나요?"로 돌아간다
  await expect(page.getByText("치료를 그만두셨나요?")).toBeVisible();
  await page.goto("/care");
  await expect(page.getByText("오늘이 투약일이에요")).toBeVisible();
});
