import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateBmi,
  isWithinInputRange,
  METRIC_CODES,
  METRIC_GROUPS,
  METRICS,
  metricsByGroup,
} from "@/domain/health-snapshot/metrics";

function prismaEnum(name: string): string[] {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const body =
    schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))?.[1] ?? "";
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));
}

describe("metric catalog", () => {
  it("Prisma MetricCode enum과 동일한 지표를 정의한다", () => {
    expect([...METRIC_CODES].sort()).toEqual(prismaEnum("MetricCode").sort());
  });

  it("모든 지표가 정의되어 있고 하나의 그룹에 속한다", () => {
    for (const code of METRIC_CODES) {
      expect(METRICS[code].code).toBe(code);
      expect(METRICS[code].inputRange.min).toBeLessThan(
        METRICS[code].inputRange.max,
      );
    }
    const grouped = METRIC_GROUPS.flatMap((g) => metricsByGroup(g.group));
    expect(grouped).toHaveLength(METRIC_CODES.length);
  });

  it("입력 허용 범위를 검사한다", () => {
    expect(isWithinInputRange("FASTING_GLUCOSE", 95)).toBe(true);
    expect(isWithinInputRange("FASTING_GLUCOSE", 9500)).toBe(false);
    expect(isWithinInputRange("HBA1C", Number.NaN)).toBe(false);
  });
});

describe("calculateBmi", () => {
  it("키·체중으로 BMI를 계산한다", () => {
    expect(calculateBmi(170, 72)).toBe(24.9);
    expect(calculateBmi(160, 50)).toBe(19.5);
  });

  it("유효하지 않은 값이면 null", () => {
    expect(calculateBmi(0, 70)).toBeNull();
    expect(calculateBmi(170, -1)).toBeNull();
  });
});
