import { isCheckupPhotoAvailable } from "@/server/ai/checkup-reader";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

// 배포 확인용 상태 점검. 개인정보·건강정보·비밀값은 응답하지 않는다.
// ai: API Key 설정 여부만 on/off로 알려준다 (AI 설명·결과표 사진 판독 사용 가능 여부)
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", db: "ok", ai: isCheckupPhotoAvailable() ? "on" : "off" },
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
