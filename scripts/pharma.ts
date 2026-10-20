/**
 * 제약사·포털 계정 만들기 (운영자 전용). 제약사 계정은 일반 가입으로 만들 수 없다.
 *
 *   npm run pharma:add -- --org "○○제약" --drugs TIRZEPATIDE_WEEKLY,SEMAGLUTIDE_WEEKLY_OB \
 *     --email user@pharma.example --name "홍담당"
 *
 * --drugs: 지속 복용 분석을 볼 수 있는 자사 제품 코드 (src/domain/glp1/drugs.ts). 계약 범위에 맞춰 지정한다.
 * 임시 비밀번호는 새 계정일 때 한 번만 보여준다.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { parseArgs } from "node:util";
import { DRUG_CODES } from "../src/domain/glp1/drugs";

// src/server/auth/password.ts 와 같은 형식 (server-only 모듈이라 여기서 직접 계산)
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      org: { type: "string" },
      drugs: { type: "string" },
      email: { type: "string" },
      name: { type: "string" },
    },
  });
  const email = values.email?.trim().toLowerCase();
  const drugs = (values.drugs ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const unknown = drugs.filter(
    (d) => !(DRUG_CODES as readonly string[]).includes(d),
  );
  if (
    !values.org ||
    !email ||
    !values.name ||
    !drugs.length ||
    unknown.length
  ) {
    if (unknown.length)
      console.error(`알 수 없는 약 코드: ${unknown.join(", ")}`);
    console.error(
      "사용법: npm run pharma:add -- --org 제약사 --drugs 코드1,코드2 --email 이메일 --name 이름",
    );
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    const org = await db.pharmaOrg.upsert({
      where: { name: values.org },
      create: { name: values.org, drugCodes: drugs },
      update: { drugCodes: drugs },
    });
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
    await db.pharmaMember.upsert({
      where: { userId: user.id },
      create: { userId: user.id, orgId: org.id },
      update: { orgId: org.id },
    });
    console.log(
      `✓ 제약사 포털 계정: ${email} → ${org.name} (${drugs.join(", ")})`,
    );
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
