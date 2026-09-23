import { BAND_POINTS } from "../rules/thresholds";
import type {
  Band,
  DomainCode,
  DomainResult,
  DomainStatus,
  Finding,
  ManagementLevel,
} from "../types";

export function finding(
  item: string,
  value: Finding["value"],
  band: Band,
  messageKey: string,
  points: number = BAND_POINTS[band],
): Finding {
  return { item, value, band, points, messageKey };
}

const isAbnormal = (f: Finding) =>
  f.band === "BORDERLINE" || f.band === "ELEVATED";

/**
 * 상태 규칙
 * - clinical (검진 수치 영역): 하나라도 ELEVATED → 관리 필요, BORDERLINE → 관심
 * - habit (생활습관 영역): ELEVATED 또는 BORDERLINE 2개 이상 → 관리 필요, BORDERLINE 1개 → 관심
 */
export type StatusRule = "clinical" | "habit";

function statusOf(findings: Finding[], rule: StatusRule): DomainStatus {
  const elevated = findings.filter((f) => f.band === "ELEVATED").length;
  const borderline = findings.filter((f) => f.band === "BORDERLINE").length;
  const normal = findings.filter((f) => f.band === "NORMAL").length;

  if (elevated > 0) return "MANAGEMENT_NEEDED";
  if (rule === "habit" && borderline >= 2) return "MANAGEMENT_NEEDED";
  if (borderline > 0) return "ATTENTION";
  // 생활습관 영역은 일부 "보통" 항목이 있어도 전반적으로 좋으면 양호
  const normalAllowance =
    rule === "habit" ? Math.floor(findings.length / 3) : 0;
  return normal <= normalAllowance ? "GOOD" : "NORMAL";
}

/** 관리 필요 점수: 가장 나쁜 지표 60% + 평균 40% + 여러 지표 동시 이상 가산 */
export const CO_OCCURRENCE_BONUS = 10;

function scoreOf(findings: Finding[]): number {
  if (findings.length === 0) return 0;
  const points = findings.map((f) => f.points);
  const max = Math.max(...points);
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  const bonus =
    findings.filter(isAbnormal).length >= 2 ? CO_OCCURRENCE_BONUS : 0;
  return Math.min(100, Math.round(0.6 * max + 0.4 * mean + bonus));
}

function levelOf(status: DomainStatus, score: number): ManagementLevel | null {
  switch (status) {
    case "GOOD":
      return 1;
    case "NORMAL":
      return 2;
    case "ATTENTION":
      return 3;
    case "MANAGEMENT_NEEDED":
      return score >= 90 ? 5 : 4;
    case "DATA_INSUFFICIENT":
      return null;
  }
}

/** 입력 충족률이 이 값보다 낮고 이상 소견이 없으면 "데이터 부족" */
export const MIN_COMPLETENESS = 0.5;

export function buildDomainResult(params: {
  domain: DomainCode;
  findings: Finding[];
  /** 영역 판단에 필요한 입력 개수 */
  requiredInputs: number;
  /** 실제 입력된 개수 */
  providedInputs: number;
  rule: StatusRule;
  managed?: boolean;
}): DomainResult {
  const {
    domain,
    findings,
    requiredInputs,
    providedInputs,
    rule,
    managed = false,
  } = params;
  const completeness =
    requiredInputs === 0
      ? 0
      : Math.round((providedInputs / requiredInputs) * 100) / 100;

  const insufficient =
    findings.length === 0 ||
    (completeness < MIN_COMPLETENESS && !findings.some(isAbnormal));
  if (insufficient) {
    return {
      domain,
      status: "DATA_INSUFFICIENT",
      level: null,
      score: 0,
      completeness,
      findings,
      managed,
    };
  }

  // 관리 필요도 높은 순으로 정렬 (동점은 입력 순서 유지 → 결정적)
  const sorted = [...findings].sort((a, b) => b.points - a.points);
  const status = statusOf(findings, rule);
  const score = scoreOf(findings);
  return {
    domain,
    status,
    level: levelOf(status, score),
    score,
    completeness,
    findings: sorted,
    managed,
  };
}

export function isPresent<T>(v: T | undefined | null): v is T {
  return v !== undefined && v !== null;
}
