import "server-only";
import type {
  AnalysisOutput,
  DomainResult,
  PriorityItem,
} from "@/domain/analysis/types";
import { db } from "@/server/db";

export type ReportData = {
  assessmentId: string;
  analyzedAt: Date;
  checkupDate: Date | null;
  engineVersion: string;
  domains: DomainResult[];
  priorities: PriorityItem[];
  dataGaps: AnalysisOutput["dataGaps"];
};

/** 사용자의 가장 최근 분석 결과 (본인 것만 조회) */
export async function getLatestReport(
  userId: string,
): Promise<ReportData | null> {
  const a = await db.assessment.findFirst({
    where: { userId, status: "ANALYZED", result: { isNot: null } },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      checkupDate: true,
      result: {
        select: {
          engineVersion: true,
          domains: true,
          priorities: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!a?.result) return null;
  // 서버가 저장한 엔진 출력 JSON (engineVersion으로 구조 식별)
  const domains = a.result.domains as unknown as DomainResult[];
  return {
    assessmentId: a.id,
    analyzedAt: a.result.updatedAt,
    checkupDate: a.checkupDate,
    engineVersion: a.result.engineVersion,
    domains,
    priorities: a.result.priorities as unknown as PriorityItem[],
    dataGaps: domains
      .filter((d) => d.status === "DATA_INSUFFICIENT")
      .map((d) => d.domain),
  };
}
