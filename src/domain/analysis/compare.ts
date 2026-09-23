import type { DomainCode, DomainResult, DomainStatus } from "./types";

/** 관리 필요 정도 순서 (데이터 부족은 비교하지 않음) */
const SEVERITY: Partial<Record<DomainStatus, number>> = {
  GOOD: 0,
  NORMAL: 1,
  ATTENTION: 2,
  MANAGEMENT_NEEDED: 3,
};

export type DomainChange = {
  domain: DomainCode;
  from: DomainStatus;
  to: DomainStatus;
  direction: "improved" | "worsened" | "same" | "unknown";
};

/** 이전 분석 대비 영역별 상태 변화 */
export function compareDomains(
  previous: DomainResult[],
  current: DomainResult[],
): DomainChange[] {
  const prev = new Map(previous.map((d) => [d.domain, d.status]));
  return current.flatMap((d) => {
    const from = prev.get(d.domain);
    if (!from) return [];
    const a = SEVERITY[from];
    const b = SEVERITY[d.status];
    const direction =
      a === undefined || b === undefined
        ? "unknown"
        : b < a
          ? "improved"
          : b > a
            ? "worsened"
            : "same";
    return [{ domain: d.domain, from, to: d.status, direction }];
  });
}
