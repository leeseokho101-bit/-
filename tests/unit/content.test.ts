import { describe, expect, it } from "vitest";
import { domainContent, statusContent } from "@/content/domains";
import { DOMAIN_CODES, DOMAIN_STATUSES } from "@/domain/analysis/types";

describe("domain content", () => {
  it("10개 영역 모두 이름과 설명이 있다", () => {
    expect(DOMAIN_CODES).toHaveLength(10);
    for (const code of DOMAIN_CODES)
      expect(domainContent[code].label).toBeTruthy();
  });

  it("상태는 색 외에 라벨·아이콘으로도 구분된다", () => {
    const labels = DOMAIN_STATUSES.map((s) => statusContent[s].label);
    const icons = DOMAIN_STATUSES.map((s) => statusContent[s].icon);
    expect(new Set(labels).size).toBe(DOMAIN_STATUSES.length);
    expect(new Set(icons).size).toBe(DOMAIN_STATUSES.length);
  });

  it("사용자 문구에 진단 표현을 쓰지 않는다", () => {
    const text = JSON.stringify({ domainContent, statusContent });
    for (const banned of ["진단", "질환", "병입니다", "위험률", "%의 확률"]) {
      expect(text).not.toContain(banned);
    }
  });
});
