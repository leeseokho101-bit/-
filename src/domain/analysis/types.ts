/**
 * 건강분석 결과 타입 (docs/ARCHITECTURE.md §5)
 * 상태는 의학적 진단이 아니라 "건강관리 관심 정도"를 뜻한다.
 */
export const DOMAIN_CODES = [
  "WEIGHT",
  "METABOLIC",
  "CARDIOVASCULAR",
  "GLYCEMIC",
  "LIVER",
  "KIDNEY",
  "EXERCISE",
  "SLEEP",
  "DIET",
  "LIFESTYLE",
] as const;
export type DomainCode = (typeof DOMAIN_CODES)[number];

export const DOMAIN_STATUSES = [
  "GOOD",
  "NORMAL",
  "ATTENTION",
  "MANAGEMENT_NEEDED",
  "DATA_INSUFFICIENT",
] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

/** 관리 필요도 1~5 (●●●○○ 표시). 데이터 부족이면 null */
export type ManagementLevel = 1 | 2 | 3 | 4 | 5;
