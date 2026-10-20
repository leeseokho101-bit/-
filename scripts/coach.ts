/**
 * 코치(영양사·운동처방사) 계정 만들기 (운영자 전용). 코치 계정은 일반 가입으로 만들 수 없다.
 *
 *   npm run coach:add -- --email coach@example.com --name "이코치" --specialty NUTRITION|EXERCISE
 *
 * - 이메일 계정이 없으면 임시 비밀번호로 새로 만들고 화면에 한 번만 보여준다.
 * - 코치가 생기면 이후 등록하는 환자부터 자동 배정된다. 이미 등록한 미배정 환자는 코칭 센터에서 "내가 맡기".
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { parseArgs } from "node:util";

// src/server/auth/password.ts 와 같은 형식 (server-only 모듈이라 여기서 직접 계산)
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      specialty: { type: "string", default: "NUTRITION" },
    },
  });
  const email = values.email?.trim().toLowerCase();
  const specialty = values.specialty === "EXERCISE" ? "EXERCISE" : "NUTRITION";
  if (!email || !values.name) {
    console.error(
      "사용법: npm run coach:add -- --email 이메일 --name 이름 [--specialty NUTRITION|EXERCISE]",
    );
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    let user = await db.user.findUnique({ where: { email } });
    let tempPassword: string | null = null;
    if (!user) {
      tempPassword = randomBytes(12).toString("base64url");
      user = await db.user.create({
        data: {
          email,
          displayName: values.name,
          passwordHash: hashPassword(tempPassword),
        },
      });
    }
    await db.coach.upsert({
      where: { userId: user.id },
      create: { userId: user.id, specialty },
      update: { specialty },
    });
    console.log(`✓ 코치 등록: ${email} (${specialty})`);
    if (tempPassword)
      console.log(
        `  임시 비밀번호: ${tempPassword}  (지금 한 번만 표시됩니다. 안전하게 전달하세요)`,
      );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("실패:", error instanceof Error ? error.message : error);
  process.exit(1);
});
