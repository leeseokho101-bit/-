import "server-only";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/db-url";

// 개발 모드 HMR 시 커넥션이 누적되지 않도록 전역에 1개만 유지합니다.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // DATABASE_URL 외에 Vercel·Neon 연동이 만드는 변수 이름도 지원
    datasourceUrl: resolveDatabaseUrl(),
    // 쿼리 로그에는 건강정보 파라미터가 포함될 수 있어 query 로그는 켜지 않습니다.
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
