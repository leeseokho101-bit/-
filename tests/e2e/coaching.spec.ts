import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser } from "@playwright/test";
import { expectAccessible, PASSWORD, signup, uniqueEmail } from "./helpers";

// 코치 계정은 화면에서 만들 수 없어 (운영 스크립트 전용) 테스트에서 DB로 권한을 붙인다
if (existsSync(".env")) process.loadEnvFile(".env");
const db = new PrismaClient();
const CODE = `E2E-C${Date.now().toString(36).toUpperCase()}`.slice(0, 20);

test.afterAll(async () => {
  await db.clinic.deleteMany({ where: { code: CODE } });
  await db.$disconnect();
});

const newPage = async (browser: Browser) =>
  (await browser.newContext()).newPage();

test("코칭: 환자 메시지 → 코치 답장(범위 밖 표현 차단) → 의원 확인 요청 → 환자·의원 화면", async ({
  browser,
}) => {
  const clinic = await db.clinic.create({
    data: { code: CODE, name: "E2E코칭의원" },
  });

  // 환자: 등록(의원 공유 동의) 후 코치에게 약 관련 질문
  const p = await newPage(browser);
  const patientEmail = uniqueEmail("coach-patient");
  await signup(p, patientEmail, "코칭환자");
  await p.goto("/care/start");
  await p.fill("#clinicCode", CODE);
  await p.selectOption("#drugCode", "SEMAGLUTIDE_WEEKLY_OB");
  await p.selectOption("#doseMg", "0.25");
  await p.check("input[name=consentService]");
  await p.check("input[name=shareWithClinic]");
  await p.click("form button[type=submit]");
  await p.waitForURL(/\/care$/);

  // 코치 (다른 코치가 이미 있을 수 있어 이 환자를 이 코치에게 직접 배정)
  const coachEmail = uniqueEmail("coach");
  const c = await newPage(browser);
  await signup(c, coachEmail, "이테스트");
  const coachUser = await db.user.findUniqueOrThrow({
    where: { email: coachEmail },
  });
  const patientUser = await db.user.findUniqueOrThrow({
    where: { email: patientEmail },
  });
  await db.coach.create({
    data: { userId: coachUser.id, specialty: "NUTRITION" },
  });
  await db.careEnrollment.update({
    where: { userId: patientUser.id },
    data: { coachId: coachUser.id },
  });

  await p.goto("/care/coach");
  await expect(p.getByText("이테스트 코치가 식사·운동")).toBeVisible();
  await p.fill("#patient-message", "다음 주에 용량을 올려도 될까요?");
  await p.getByRole("button", { name: "보내기" }).click();
  await expect(p.getByRole("status")).toContainText("보냈어요");
  await expect(p.locator("#patient-message")).toHaveValue("");
  await expectAccessible(p);

  // 코치: 로그인하면 코칭 센터로
  await c.context().clearCookies();
  await c.goto("/login");
  await c.fill("#email", coachEmail);
  await c.fill("#password", PASSWORD);
  await c.click("form button[type=submit]");
  await c.waitForURL("**/coach");
  await expect(c.getByText("새 메시지 1")).toBeVisible();
  await expect(c.getByText("약 관련 문의").first()).toBeVisible();
  await expectAccessible(c);

  await c.getByRole("link", { name: /코칭환자/ }).click();
  await c.waitForURL("**/coach/patients/**");
  await c.fill("#coach-message", "괜찮으면 증량해 보세요");
  await c.getByRole("button", { name: "보내기" }).click();
  await expect(
    c.getByText("증량·감량에 관한 안내는 코칭 범위가 아니에요"),
  ).toBeVisible();
  await c.getByRole("button", { name: "약 문의 답장 넣기" }).click();
  await c.getByRole("button", { name: "보내기" }).click();
  await expect(c.getByRole("status")).toContainText("보냈어요");
  await expectAccessible(c);

  await c.click("text=담당 의원에 확인 요청 (에스컬레이션)");
  await c.selectOption("#referral-reason", "MEDICATION_QUESTION");
  await c.fill("#referral-note", "증량 문의, 메스꺼움 지속");
  await c.getByRole("button", { name: "담당 의원에 확인 요청" }).click();
  await expect(c.getByRole("status").last()).toContainText(
    "담당 의원 화면에 확인 요청을 남겼어요",
  );

  // 환자: 답장·안내와 홈 위험 신호
  await p.goto("/care/coach");
  await expect(
    p.getByText("약과 용량, 투약 일정에 관한 질문은 담당 의사가"),
  ).toBeVisible();
  await expect(
    p.getByText("담당 코치가 의원과 상의해 보시도록 확인을 요청했어요"),
  ).toBeVisible();
  await p.goto("/care");
  await expect(p.locator("section[role=alert]")).toContainText(
    "담당 코치가 의원과 상의해",
  );

  // 의원: 의사 대시보드에 코치 의뢰
  await db.clinicStaff.create({
    data: { userId: coachUser.id, clinicId: clinic.id },
  });
  await c.goto("/clinic");
  await expect(c.getByText("코치 의뢰").first()).toBeVisible();
  await expect(
    c.getByText("(약·용량 문의 — 증량 문의, 메스꺼움 지속)").first(),
  ).toBeVisible();
});

test("코치가 아니면 코칭 센터는 없는 화면", async ({ browser }) => {
  const page = await newPage(browser);
  await signup(page, uniqueEmail("not-coach"));
  const res = await page.goto("/coach");
  expect(res?.status()).toBe(404);
});
