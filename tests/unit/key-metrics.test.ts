import { describe, expect, it } from "vitest";
import { analyze } from "@/domain/analysis/engine";
import { sampleUsers } from "@/dev/samples";
import { buildKeyMetrics } from "@/features/analysis/key-metrics";
import { snapshotOf } from "./engine-helpers";

const metricsOf = (id: string) => {
  const s = sampleUsers.find((x) => x.id === id)!;
  return buildKeyMetrics(analyze(snapshotOf(s)).domains, s.sex);
};

describe("주요 건강 데이터", () => {
  it("엔진 판정 구간을 그대로 사용하고 단위를 붙인다", () => {
    const m = new Map(metricsOf("E").map((x) => [x.item, x]));
    expect(m.get("BP")).toMatchObject({
      value: "148/94 mmHg",
      band: "ELEVATED",
    });
    expect(m.get("HBA1C")).toMatchObject({ value: "6.8%", band: "ELEVATED" });
    expect(m.get("HDL")).toMatchObject({
      value: "36 mg/dL",
      band: "BORDERLINE",
    });
    expect(m.get("WAIST")?.guide).toBe("90cm 미만");
  });

  it("허리둘레 참고 범위는 성별에 따라 다르다", () => {
    expect(metricsOf("B").find((x) => x.item === "WAIST")?.guide).toBe(
      "85cm 미만",
    );
  });

  it("입력하지 않은 수치는 표시하지 않는다 (가상 D: HbA1c·eGFR 미입력)", () => {
    const items = metricsOf("D").map((x) => x.item);
    expect(items).not.toContain("HBA1C");
    expect(items).not.toContain("EGFR");
    expect(items).toContain("BMI");
  });
});
