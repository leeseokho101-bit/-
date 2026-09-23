import { describe, expect, it } from "vitest";
import { sampleUsers } from "@/dev/samples";
import type { AssessmentInputs } from "@/features/assessment/queries";
import { buildReviewSummary } from "@/features/assessment/review-summary";

function inputsOf(id: string): AssessmentInputs {
  const s = sampleUsers.find((x) => x.id === id)!;
  return {
    displayName: s.displayName,
    profile: { sex: s.sex, birthDate: new Date(s.birthDate) },
    checkupDate: new Date(s.checkupDate),
    metrics: s.metrics,
    survey: s.survey,
    hasSurvey: true,
    medications: s.medications.map((m) => ({
      name: m.name,
      purpose: m.purpose ?? null,
      frequency: m.frequency ?? null,
    })),
  };
}

const lifestyle = (id: string) =>
  buildReviewSummary(inputsOf(id)).find((x) => x.step === "lifestyle")!;

describe("buildReviewSummary", () => {
  it("비흡연자에게는 흡연량 문항을 표시하지 않는다", () => {
    const rows = lifestyle("A").rows;
    expect(rows.find((r) => r.label === "하루 흡연량")).toBeUndefined();
    expect(rows.every((r) => r.value !== null)).toBe(true);
  });

  it("현재 흡연자에게는 흡연량을 표시한다", () => {
    expect(
      lifestyle("D").rows.find((r) => r.label === "하루 흡연량")?.value,
    ).toBe("10개비");
  });

  it("미입력 검진 항목은 null(미입력)로 표시한다", () => {
    const checkup = buildReviewSummary(inputsOf("D")).find(
      (x) => x.step === "checkup",
    )!;
    expect(
      checkup.rows.filter((r) => r.value === null).map((r) => r.label),
    ).toEqual(["당화혈색소(HbA1c)", "크레아티닌", "사구체여과율(eGFR)"]);
  });
});
