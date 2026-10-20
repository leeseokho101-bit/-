import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { expectAccessible, signup, uniqueEmail } from "./helpers";

// 의료진 계정은 화면에서 만들 수 없어 (운영 스크립트 전용) 테스트에서 DB로 권한을 붙인다
if (existsSync(".env")) process.loadEnvFile(".env");
const db = new PrismaClient();
const CODE = `E2E-${Date.now().toString(36).toUpperCase()}`.slice(0, 20);

test.afterAll(async () => {
  await db.clinic.deleteMany({ where: { code: CODE } });
  await db.$disconnect();
});

async function enroll(page: import("@playwright/test").Page, share: boolean) {
  await page.goto("/care/start");
  await page.fill("#clinicCode", CODE);
  await page.selectOption("#drugCode", "TIRZEPATIDE_WEEKLY");
  await page.selectOption("#doseMg", "2.5");
  await page.check("input[name=consentService]");
  if (share) await page.check("input[name=shareWithClinic]");
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/care$/);
}

test("의사 대시보드: 공유 동의 환자만 보이고, 알림 확인·내원 기록을 할 수 있다", async ({
  browser,
}) => {
  const clinic = await db.clinic.create({
    data: { code: CODE, name: "E2E가상의원" },
  });

  // 환자 1: 공유 동의 + 위험 신호
  const p1 = await (await browser.newContext()).newPage();
  await signup(p1, uniqueEmail("clinic-p1"), "공유환자");
  await enroll(p1, true);
  await p1.goto("/care/check-in");
  await p1.check("input[name='redFlag.LOW_GLUCOSE_SYMPTOMS']");
  await p1.getByRole("button", { name: "체크인 저장" }).click();
  await expect(
    p1.getByRole("heading", { name: "오늘 담당 의원에 연락해 상의해 주세요" }),
  ).toBeVisible();

  // 환자 2: 같은 의원이지만 공유 동의 안 함
  const p2 = await (await browser.newContext()).newPage();
  await signup(p2, uniqueEmail("clinic-p2"), "비공유환자");
  await enroll(p2, false);
  // 일반 사용자는 의사 대시보드가 없는 화면처럼 보인다
  const res = await p2.goto("/clinic");
  expect(res?.status()).toBe(404);

  // 의사
  const doctorEmail = uniqueEmail("clinic-doctor");
  const d = await (await browser.newContext()).newPage();
  await signup(d, doctorEmail, "가상의사");
  const doctor = await db.user.findUniqueOrThrow({
    where: { email: doctorEmail },
  });
  await db.clinicStaff.create({
    data: { userId: doctor.id, clinicId: clinic.id },
  });
  await d.context().clearCookies();
  await d.goto("/login");
  await d.fill("#email", doctorEmail);
  await d.fill("#password", "e2e-password-1");
  await d.click("form button[type=submit]");
  await d.waitForURL("**/clinic");

  await expect(d.getByRole("link", { name: "공유환자" }).first()).toBeVisible();
  await expect(d.getByText("비공유환자")).toHaveCount(0);
  await expect(d.getByText("체크인 위험 신호·심한 증상").first()).toBeVisible();
  await expectAccessible(d);

  await d.getByRole("table").getByRole("link", { name: "공유환자" }).click();
  await d.waitForURL("**/clinic/patients/**");
  await expect(d.getByText("내원 전 1장 리포트")).toBeVisible();
  await expect(d.getByText("참고 지표 (증량 판단 참고)")).toBeVisible();
  await expectAccessible(d);

  await d.getByRole("button", { name: "모두 확인 처리" }).click();
  await expect(d.getByText("미확인 0건")).toBeVisible();
  await d.fill("#chartNo", "C-777");
  await d.getByRole("button", { name: "저장", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("저장했어요");
  await d.getByRole("button", { name: /오늘 진료 완료로 기록/ }).click();
  await d.goto("/clinic");
  await expect(d.getByText("#C-777")).toBeVisible();

  // 다른 환자 리포트 주소를 직접 열어도 볼 수 없다
  const p2User = await db.careEnrollment.findFirstOrThrow({
    where: { clinicId: clinic.id, shareWithClinic: false },
  });
  const blocked = await d.goto(`/clinic/patients/${p2User.userId}`);
  expect(blocked?.status()).toBe(404);
});

test("로그인하지 않으면 의사 대시보드는 로그인 화면으로", async ({ page }) => {
  await page.goto("/clinic");
  await page.waitForURL("**/login**");
});
