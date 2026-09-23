import { db } from "@/server/db";
import { logger } from "@/server/logger";

// 배포 확인용 상태 점검. 개인정보·건강정보는 응답하지 않는다.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", db: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("health check failed", { error });
    return Response.json(
      { status: "error", db: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
