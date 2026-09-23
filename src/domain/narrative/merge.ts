/**
 * LLM 설명 + 템플릿 설명 병합
 * - 엔진 결과에 없는 영역·순위는 무시 (LLM이 상태·순서를 바꿀 수 없음)
 * - 안전 검사를 통과한 문장만 사용하고, 나머지는 템플릿 문구로 대체
 */
import { checkText } from "./safety";
import type { LlmNarrative, Narrative } from "./types";

export type MergeReport = { replaced: string[] };

export function mergeNarrative(
  llm: LlmNarrative,
  template: Narrative,
): { narrative: Narrative; report: MergeReport } {
  const replaced: string[] = [];
  const pick = (
    field: string,
    candidate: string | undefined,
    fallback: string,
  ) => {
    if (candidate !== undefined) {
      const r = checkText(candidate);
      if (r.ok) return candidate.trim();
      replaced.push(`${field}:${r.reason}`);
    } else {
      replaced.push(`${field}:missing`);
    }
    return fallback;
  };

  const llmDomains = new Map(llm.domains.map((d) => [d.code, d.explanation]));
  const llmPriorities = new Map(llm.priorities.map((p) => [p.code, p]));

  const domains: Narrative["domains"] = {};
  for (const [code, fallback] of Object.entries(template.domains) as [
    keyof Narrative["domains"],
    string,
  ][]) {
    domains[code] = pick(`domain.${code}`, llmDomains.get(code), fallback);
  }

  // 순서는 템플릿(= 엔진 우선순위) 기준
  const priorities = template.priorities.map((t) => {
    const l = llmPriorities.get(t.domain);
    return {
      domain: t.domain,
      why: pick(`priority.${t.domain}.why`, l?.why, t.why),
      firstStep: pick(
        `priority.${t.domain}.firstStep`,
        l?.firstStep,
        t.firstStep,
      ),
    };
  });

  const summary = pick("summary", llm.summary, template.summary);
  const encouragement = pick(
    "encouragement",
    llm.encouragement,
    template.encouragement,
  );

  const narrative: Narrative = {
    version: template.version,
    source: replaced.length === 0 ? "llm" : "mixed",
    summary,
    domains,
    priorities,
    encouragement,
  };
  return { narrative, report: { replaced } };
}
