import { describe, expect, it } from "vitest";
import { assessmentSteps, getAssessmentStep, routes } from "@/lib/routes";

describe("assessment steps", () => {
  it("설계 순서대로 6단계로 구성된다", () => {
    expect(assessmentSteps.map((s) => s.slug)).toEqual([
      "profile",
      "checkup",
      "survey",
      "lifestyle",
      "medications",
      "review",
    ]);
  });

  it("첫 단계의 이전은 동의 화면, 마지막 단계의 다음은 분석 화면이다", () => {
    expect(getAssessmentStep("profile").prevPath).toBe(routes.assessment);
    expect(getAssessmentStep("review").nextPath).toBe("/assessment/analyzing");
  });

  it("중간 단계는 앞뒤 단계로 연결된다", () => {
    const s = getAssessmentStep("survey");
    expect(s.number).toBe(3);
    expect(s.total).toBe(6);
    expect(s.prevPath).toBe("/assessment/checkup");
    expect(s.nextPath).toBe("/assessment/lifestyle");
  });
});
