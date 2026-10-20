/**
 * 의원·의료진 계정 만들기 (운영자 전용). 의료진 계정은 일반 가입으로 만들 수 없다.
 *
 *   npm run clinic:staff -- --clinic-code ABCD-1234 --clinic-name "○○내과의원" \
 *     --email doctor@clinic.example --name "김의사" [--role DOCTOR|NURSE]
 *
 * - 의원 코드가 없으면 의원을 새로 만든다 (등록 QR 카드에 넣을 코드).
 * - 이메일 계정이 없으면 임시 비밀번호로 새로 만들고, 화면에 한 번만 보여준다 (로그·DB에 평문 없음).
 * - 이미 있는 계정이면 의료진 권한만 붙인다 (환자로 쓰던 계정이어도 된다).
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
      "clinic-code": { type: "string" },
      "clinic-name": { type: "string" },
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "DOCTOR" },
    },
  });
  const code = values["clinic-code"]?.trim().toUpperCase();
  const email = values.email?.trim().toLowerCase();
  const role = values.role === "NURSE" ? "NURSE" : "DOCTOR";
  if (!code || !/^[A-Z0-9-]{4,20}$/.test(code) || !email || !values.name) {
    console.error(
      "사용법: npm run clinic:staff -- --clinic-code CODE --clinic-name 이름 --email 이메일 --name 이름 [--role DOCTOR|NURSE]",
    );
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    let clinic = await db.clinic.findUnique({ where: { code } });
    if (!clinic) {
      if (!values["clinic-name"])
        throw new Error("새 의원에는 --clinic-name 이 필요합니다.");
      clinic = await db.clinic.create({
        data: { code, name: values["clinic-name"] },
      });
      console.log(`✓ 의원 생성: ${clinic.name} (${code})`);
    }
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
    await db.clinicStaff.upsert({
      where: { userId: user.id },
      create: { userId: user.id, clinicId: clinic.id, role },
      update: { clinicId: clinic.id, role },
    });
    console.log(`✓ 의료진 등록: ${email} → ${clinic.name} (${role})`);
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
