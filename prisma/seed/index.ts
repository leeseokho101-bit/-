/**
 * 개발 DB에 가상 사용자 A~E를 생성합니다.  실행: npm run db:seed
 * ⚠️ production 환경에서는 실행되지 않습니다. 실제 개인정보를 사용하지 않습니다.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { sampleUsers, SAMPLE_PASSWORD } from "../../src/dev/samples";
import {
  assertSampleEnvironment,
  resetSampleUser,
} from "../../src/dev/seed-sample";

// src/server/auth/password.ts 와 같은 형식 (server-only 모듈이라 여기서 직접 계산)
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function main() {
  assertSampleEnvironment();
  const db = new PrismaClient();
  try {
    const passwordHash = hashPassword(SAMPLE_PASSWORD);
    for (const sample of sampleUsers) {
      await resetSampleUser(db, sample, passwordHash);
      console.log(`✓ 가상 사용자 ${sample.id} (${sample.email})`);
    }
    console.log(`\n샘플 계정 비밀번호: ${SAMPLE_PASSWORD} (개발 환경 전용)`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
