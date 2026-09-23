/**
 * 건강관리 우선순위 TOP 3
 * priorityScore = (영역 점수 × 영역 가중치 + 연결 효과) × 데이터 충분성 계수
 * 질병 확률이나 위험도가 아니라 "먼저 관리하면 좋은 순서"를 뜻한다.
 */
import {
  DOMAIN_CODES,
  type DomainCode,
  type DomainResult,
  type PriorityItem,
  type PriorityMode,
} from "./types";

/** 영역 가중치: 검진 수치 영역을 조금 더 무겁게 본다 */
export const DOMAIN_WEIGHTS: Record<DomainCode, number> = {
  GLYCEMIC: 1.2,
  CARDIOVASCULAR: 1.15,
  METABOLIC: 1.0,
  LIVER: 1.0,
  KIDNEY: 1.0,
  WEIGHT: 0.95,
  LIFESTYLE: 0.95,
  EXERCISE: 0.9,
  SLEEP: 0.85,
  DIET: 0.85,
};

/** 이 영역을 관리하면 함께 좋아질 수 있는 영역 */
export const RELATED_DOMAINS: Record<DomainCode, DomainCode[]> = {
  WEIGHT: ["METABOLIC", "GLYCEMIC", "CARDIOVASCULAR", "LIVER"],
  METABOLIC: ["WEIGHT", "GLYCEMIC", "CARDIOVASCULAR"],
  CARDIOVASCULAR: ["METABOLIC", "LIFESTYLE"],
  GLYCEMIC: ["METABOLIC", "WEIGHT"],
  LIVER: ["LIFESTYLE", "WEIGHT"],
  KIDNEY: ["CARDIOVASCULAR", "GLYCEMIC"],
  EXERCISE: ["WEIGHT", "METABOLIC", "GLYCEMIC", "CARDIOVASCULAR", "SLEEP"],
  SLEEP: ["LIFESTYLE", "WEIGHT", "GLYCEMIC"],
  DIET: ["WEIGHT", "METABOLIC", "GLYCEMIC", "CARDIOVASCULAR", "LIVER"],
  LIFESTYLE: ["CARDIOVASCULAR", "LIVER", "SLEEP"],
};

const LINK_BONUS_EACH = 3;
const LINK_BONUS_MAX = 9;
const HABIT_DOMAINS: DomainCode[] = ["EXERCISE", "SLEEP", "DIET", "LIFESTYLE"];

const needsCare = (d: DomainResult) =>
  d.status === "ATTENTION" || d.status === "MANAGEMENT_NEEDED";

const order = (d: DomainCode) => DOMAIN_CODES.indexOf(d);

export function calculatePriorities(domains: DomainResult[]): PriorityItem[] {
  const byCode = new Map(domains.map((d) => [d.domain, d]));
  const flagged = new Set(domains.filter(needsCare).map((d) => d.domain));

  const related = (d: DomainCode) =>
    RELATED_DOMAINS[d].filter((r) => flagged.has(r));

  const improve = domains.filter(needsCare).map((d) => {
    const link = Math.min(
      LINK_BONUS_MAX,
      related(d.domain).length * LINK_BONUS_EACH,
    );
    const dataFactor = 0.7 + 0.3 * d.completeness;
    const priorityScore =
      Math.round(
        (d.score * DOMAIN_WEIGHTS[d.domain] + link) * dataFactor * 10,
      ) / 10;
    return { d, priorityScore, mode: "IMPROVE" as PriorityMode };
  });
  improve.sort(
    (a, b) =>
      b.priorityScore - a.priorityScore ||
      order(a.d.domain) - order(b.d.domain),
  );

  const picked = improve.slice(0, 3);

  // 관리가 필요한 영역이 3개 미만이면 "유지" 항목으로 채운다 (생활습관 영역 우선)
  if (picked.length < 3) {
    const used = new Set(picked.map((p) => p.d.domain));
    const maintain = [
      ...HABIT_DOMAINS,
      ...DOMAIN_CODES.filter((c) => !HABIT_DOMAINS.includes(c)),
    ]
      .map((c) => byCode.get(c))
      .filter((d): d is DomainResult => !!d && !used.has(d.domain))
      .filter((d) => d.status === "GOOD" || d.status === "NORMAL")
      // 보통 → 양호 순, 같은 상태면 점수가 높은(개선 여지가 큰) 순, 이후 고정 순서
      .sort(
        (a, b) =>
          (a.status === "NORMAL" ? 0 : 1) - (b.status === "NORMAL" ? 0 : 1) ||
          b.score - a.score ||
          (HABIT_DOMAINS.includes(a.domain) ? 0 : 1) -
            (HABIT_DOMAINS.includes(b.domain) ? 0 : 1) ||
          order(a.domain) - order(b.domain),
      );
    for (const d of maintain.slice(0, 3 - picked.length)) {
      picked.push({ d, priorityScore: 0, mode: "MAINTAIN" });
    }
  }

  return picked.map((p, i) => ({
    rank: (i + 1) as 1 | 2 | 3,
    domain: p.d.domain,
    mode: p.mode,
    priorityScore: p.priorityScore,
    reasons: p.d.findings
      .filter((f) =>
        p.mode === "IMPROVE"
          ? f.band === "BORDERLINE" || f.band === "ELEVATED"
          : f.band === "OPTIMAL" || f.band === "NORMAL",
      )
      .map((f) => f.messageKey)
      .slice(0, 3),
    relatedDomains: p.mode === "IMPROVE" ? related(p.d.domain) : [],
  }));
}
