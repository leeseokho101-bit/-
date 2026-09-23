import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/** E2E에서 만든 가상 계정 정리 */
export default async function globalTeardown() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const db = new PrismaClient();
  try {
    await db.user.deleteMany({
      where: { email: { startsWith: "e2e-", endsWith: "@example.invalid" } },
    });
  } finally {
    await db.$disconnect();
  }
}
