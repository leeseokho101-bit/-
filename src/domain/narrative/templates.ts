/**
 * 템플릿 설명 (LLM을 쓸 수 없거나, LLM 문구가 안전 검사를 통과하지 못할 때 사용)
 * 같은 분석 결과 → 항상 같은 문구.
 */
import { domainContent } from "@/content/domains";
import { josa } from "@/lib/josa";
import type {
  AnalysisOutput,
  DomainCode,
  DomainResult,
} from "@/domain/analysis/types";
import type { NarrativeInput } from "./input";
import { NARRATIVE_VERSION, type Narrative } from "./types";

export const CONSULT_SENTENCE = "정확한 판단은 의료진과 상담하시기 바랍니다.";

/** 영역별 첫 실천 (생활습관 중심, 약·치료 관련 권고 없음) */
export const firstSteps: Record<DomainCode, string> = {
  WEIGHT:
    "저녁 식사량을 평소보다 조금 줄이고, 식사 후 15~20분 걷기부터 시작해 보세요.",
  METABOLIC:
    "단 음료와 야식을 줄이고 하루 30분 걷기를 시작해 보세요. 한 달에 한 번 허리둘레를 재 보는 것도 도움이 돼요.",
  CARDIOVASCULAR:
    "짠 음식과 국물을 조금씩 줄이고, 가능하면 집에서 혈압을 재서 기록해 보세요.",
  GLYCEMIC:
    "단 음료와 흰쌀·빵 같은 정제 탄수화물을 줄이고, 식사 후 10~15분 가볍게 걸어 보세요.",
  LIVER: "음주 횟수와 양을 줄이고, 기름진 음식과 야식을 줄여 보세요.",
  KIDNEY:
    "음식을 싱겁게 먹고 물을 충분히 마시며, 다음 검진에서 수치를 다시 확인해 보세요.",
  EXERCISE: "하루 걸음 수를 지금보다 1,000보 늘리는 것부터 시작해 보세요.",
  SLEEP:
    "매일 같은 시간에 잠자리에 들고, 잠들기 1시간 전에는 휴대폰 사용을 줄여 보세요.",
  DIET: "하루 한 끼는 채소 반찬을 충분히 곁들이고, 단 음료를 물이나 차로 바꿔 보세요.",
  LIFESTYLE: "흡연·음주·스트레스 중 가장 바꾸기 쉬운 한 가지부터 줄여 보세요.",
};

const CLINICAL: DomainCode[] = [
  "WEIGHT",
  "METABOLIC",
  "CARDIOVASCULAR",
  "GLYCEMIC",
  "LIVER",
  "KIDNEY",
];

function lifestyleFirstStep(d: DomainResult | undefined): string {
  if (d?.findings.some((f) => f.messageKey === "lifestyle.smoking.current")) {
    return "보건소 금연클리닉 같은 금연 지원 프로그램을 알아보는 것부터 시작해 보세요.";
  }
  if (d?.findings.some((f) => f.messageKey === "lifestyle.alcohol.highRisk")) {
    return "술 마시는 날을 일주일에 하루씩 줄이고, 한 번에 마시는 양도 줄여 보세요.";
  }
  return firstSteps.LIFESTYLE;
}

function domainExplanation(d: DomainResult, facts: string[]): string {
  const label = domainContent[d.domain].label;
  const lead = facts.slice(0, 2).join(" ");
  switch (d.status) {
    case "GOOD":
      return `${josa(label, "은/는")} 양호한 편이에요. ${lead}`.trim();
    case "NORMAL":
      return `${josa(label, "은/는")} 보통 수준이에요. ${lead}`.trim();
    case "ATTENTION":
      return `${label}에 관심이 필요한 상태입니다. ${lead}`.trim();
    case "MANAGEMENT_NEEDED":
      return `${josa(label, "은/는")} 관리가 필요한 영역입니다. ${lead}${CLINICAL.includes(d.domain) ? ` ${CONSULT_SENTENCE}` : ""}`.trim();
    case "DATA_INSUFFICIENT":
      return `${josa(label, "은/는")} 입력된 정보가 부족해 판단하지 않았어요. 관련 항목을 입력하면 더 정확히 알려드릴게요.`;
  }
}

export function buildTemplateNarrative(
  output: AnalysisOutput,
  input: NarrativeInput,
): Narrative {
  const byCode = new Map(output.domains.map((d) => [d.domain, d]));
  const factsOf = new Map(input.domains.map((d) => [d.code, d.facts]));
  // 근거 문장: 이상 소견을 우선 (findings는 관리 필요도 높은 순으로 정렬되어 있음)
  const abnormalFacts = (d: DomainResult) =>
    d.findings
      .map((f, i) => ({ f, text: factsOf.get(d.domain)?.[i] }))
      .filter(
        (x) => x.text && (x.f.band === "BORDERLINE" || x.f.band === "ELEVATED"),
      )
      .map((x) => x.text!);

  const domains: Narrative["domains"] = {};
  for (const d of output.domains) {
    const abnormal = abnormalFacts(d);
    domains[d.domain] = domainExplanation(
      d,
      abnormal.length ? abnormal : (factsOf.get(d.domain) ?? []),
    );
  }

  const managed = output.domains.filter(
    (d) => d.status === "MANAGEMENT_NEEDED",
  ).length;
  const attention = output.domains.filter(
    (d) => d.status === "ATTENTION",
  ).length;
  const top = output.priorities[0];
  const maintainOnly =
    output.priorities.length > 0 &&
    output.priorities.every((p) => p.mode === "MAINTAIN");

  let summary: string;
  if (output.priorities.length === 0) {
    summary =
      "입력된 정보가 부족해 건강영역을 판단하기 어려워요. 기본정보와 건강검진 수치를 입력해 주세요.";
  } else if (maintainOnly) {
    summary =
      "입력하신 정보로는 특별히 관리가 필요한 영역이 없어요. 지금의 좋은 습관을 꾸준히 유지하는 것이 가장 중요해요.";
  } else {
    const parts = [
      managed > 0 ? `관리가 필요한 영역 ${managed}개` : null,
      attention > 0 ? `관심이 필요한 영역 ${attention}개` : null,
    ].filter(Boolean);
    summary = `10개 건강영역 중 ${parts.join(", ")}가 있어요. 여러 정보를 종합했을 때 ${josa(domainContent[top.domain].label, "을/를")} 가장 먼저 관리해 보시길 권해요.`;
  }

  const priorities = output.priorities.map((p, i) => {
    const d = byCode.get(p.domain);
    const label = domainContent[p.domain].label;
    const inputP = input.priorities[i];
    if (p.mode === "MAINTAIN") {
      return {
        domain: p.domain,
        why: `${josa(label, "은/는")} 현재 좋은 상태예요. ${inputP?.reasons[0] ?? ""}`.trim(),
        firstStep: `지금의 ${label} 습관을 꾸준히 유지해 보세요.`,
      };
    }
    const reasons = (inputP?.reasons ?? []).slice(0, 2).join(" ");
    const related = inputP?.relatedAreas.length
      ? ` ${josa(label, "을/를")} 관리하면 ${inputP.relatedAreas.join(", ")}에도 도움이 될 수 있어요.`
      : "";
    const note = inputP?.orderNote ? ` ${inputP.orderNote}` : "";
    return {
      domain: p.domain,
      why: `${reasons}${note}${related}`.trim(),
      firstStep:
        p.domain === "LIFESTYLE" ? lifestyleFirstStep(d) : firstSteps[p.domain],
    };
  });

  const encouragement = maintainOnly
    ? "좋은 습관을 잘 지키고 계세요. 작은 습관을 꾸준히 이어가는 것이 가장 큰 힘이 됩니다."
    : "한 번에 모든 것을 바꿀 필요는 없어요. 첫 번째 우선순위부터 작은 실천을 시작해 보세요. 12주 뒤의 변화를 함께 확인해요.";

  return {
    version: NARRATIVE_VERSION,
    source: "template",
    summary,
    domains,
    priorities,
    encouragement,
  };
}
