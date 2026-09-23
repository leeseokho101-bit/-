import { describe, expect, it } from "vitest";
import { analyze } from "@/domain/analysis/engine";
import { canonicalJson } from "@/domain/analysis/snapshot";
import { DOMAIN_CODES } from "@/domain/analysis/types";
import { sampleUsers } from "@/dev/samples";
import { analyzeSample, snapshotOf } from "./engine-helpers";

const top = (id: Parameters<typeof analyzeSample>[0]) =>
  analyzeSample(id).priorities.map((p) => p.domain);

describe("가상 사용자별 분석 결과", () => {
  it("모든 사용자에게 10개 영역과 TOP 3를 만든다", () => {
    for (const s of sampleUsers) {
      const out = analyze(snapshotOf(s));
      expect(out.domains.map((d) => d.domain)).toEqual([...DOMAIN_CODES]);
      expect(out.priorities.map((p) => p.rank)).toEqual([1, 2, 3]);
      expect(out.engineVersion).toMatch(/^rules-/);
    }
  });

  it("A(양호): 관리 필요 영역이 없고 '유지' 중심 TOP 3", () => {
    const out = analyzeSample("A");
    expect(
      out.domains.every((d) => d.status === "GOOD" || d.status === "NORMAL"),
    ).toBe(true);
    expect(out.priorities.every((p) => p.mode === "MAINTAIN")).toBe(true);
  });

  it("B(체중관리): 1순위 체중, TOP 3에 운동 포함", () => {
    const t = top("B");
    expect(t[0]).toBe("WEIGHT");
    expect(t).toContain("EXERCISE");
  });

  it("C(혈당관리): 1순위 혈당", () => {
    expect(top("C")[0]).toBe("GLYCEMIC");
  });

  it("D(생활습관): TOP 3가 모두 생활습관 영역이고, 미입력 신장은 데이터 부족", () => {
    const out = analyzeSample("D");
    for (const d of top("D"))
      expect(["SLEEP", "EXERCISE", "LIFESTYLE", "DIET"]).toContain(d);
    expect(out.dataGaps).toEqual(["KIDNEY"]);
    const kidney = out.domains.find((d) => d.domain === "KIDNEY")!;
    expect(kidney.level).toBeNull();
  });

  it("E(복합): 관리 필요 영역이 5개 이상이고 TOP 3가 기대 영역 안에 있다", () => {
    const out = analyzeSample("E");
    expect(
      out.domains.filter((d) => d.status === "MANAGEMENT_NEEDED").length,
    ).toBeGreaterThanOrEqual(5);
    const expected = sampleUsers.find((s) => s.id === "E")!.expectedFocus;
    for (const d of top("E")) expect(expected).toContain(d);
    // 복용 목적(혈압·콜레스테롤)은 '관리 중'으로 표시만 한다
    expect(
      out.domains.find((d) => d.domain === "CARDIOVASCULAR")!.managed,
    ).toBe(true);
  });
});

describe("결과의 일관성", () => {
  it("같은 입력은 항상 같은 결과", () => {
    for (const s of sampleUsers) {
      expect(analyze(snapshotOf(s))).toEqual(analyze(snapshotOf(s)));
    }
  });

  it("canonicalJson은 키 순서와 무관하다", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 2], c: undefined } })).toBe(
      canonicalJson({ a: { d: [1, 2] }, b: 1 }),
    );
  });

  it("결과에 질병 확률·진단 같은 값이 포함되지 않는다", () => {
    const text = JSON.stringify(analyzeSample("E"));
    expect(text).not.toMatch(/probability|risk%|diagnos/i);
  });
});
