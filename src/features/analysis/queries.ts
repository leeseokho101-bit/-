import "server-only";
import { ageOn } from "@/domain/analysis/snapshot";
import type {
  AnalysisOutput,
  DomainResult,
  PriorityItem,
} from "@/domain/analysis/types";
import { buildNarrativeInput } from "@/domain/narrative/input";
import { buildTemplateNarrative } from "@/domain/narrative/templates";
import type { Narrative } from "@/domain/narrative/types";
import { db } from "@/server/db";
import { parseStoredNarrative, toAnalysisOutput } from "./narrative";

export type ReportData = {
  assessmentId: string;
  analyzedAt: Date;
  checkupDate: Date | null;
  engineVersion: string;
  domains: DomainResult[];
  priorities: PriorityItem[];
  dataGaps: AnalysisOutput["dataGaps"];
  narrative: Narrative;
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
      submittedAt: true,
      createdAt: true,
      user: { select: { profile: { select: { sex: true, birthDate: true } } } },
      result: {
        select: {
          engineVersion: true,
          domains: true,
          priorities: true,
          narrative: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!a?.result) return null;

  const output = toAnalysisOutput(a.result);
  // 설명이 아직 저장되지 않았으면 템플릿 설명을 즉석에서 만든다
  let narrative = parseStoredNarrative(a.result.narrative);
  if (!narrative) {
    const profile = a.user.profile;
    const age = profile
      ? ageOn(profile.birthDate, a.checkupDate ?? a.submittedAt ?? a.createdAt)
      : 50;
    narrative = buildTemplateNarrative(
      output,
      buildNarrativeInput(output, { age, sex: profile?.sex ?? "MALE" }),
    );
  }
  return {
    assessmentId: a.id,
    analyzedAt: a.result.updatedAt,
    checkupDate: a.checkupDate,
    engineVersion: output.engineVersion,
    domains: output.domains,
    priorities: output.priorities,
    dataGaps: output.dataGaps,
    narrative,
  };
}
