import { describe, expect, it } from "vitest";
import {
  coachScopeNote,
  patientChatNote,
  scopeReasonText,
} from "@/content/coaching";
import {
  checkCoachMessage,
  isMedicationQuestion,
  MEDICATION_REPLY,
} from "@/domain/coaching/scope";
import {
  feedbackFocus,
  proteinTarget,
  weeklyFeedbackDraft,
  type WeekSummary,
} from "@/domain/coaching/weekly";
import { checkText } from "@/domain/narrative/safety";
import { weekStart } from "@/features/coaching/service";

describe("코칭 범위", () => {
  it("생활습관 코칭은 보낼 수 있다", () => {
    for (const t of [
      "끼니마다 두부나 달걀을 손바닥 크기만큼 먼저 드셔 보세요.",
      "식후 10분 걷기를 이번 주 목표로 해 볼까요?",
      "레시피 참고: https://example.com/recipe",
      "식후 혈당이 180mg/dL 넘지 않게 채소부터 드셔 보세요.",
      MEDICATION_REPLY,
    ])
      expect(checkCoachMessage(t), t).toEqual({ ok: true });
  });

  it("약 지시·용량 수치·증량 안내·투약 건너뛰기·진단은 막는다", () => {
    const cases: [string, string][] = [
      ["다음 주부터 5mg으로 가셔도 될 것 같아요", "dose-number"],
      ["속이 괜찮으면 증량해 보세요", "dose-change"],
      ["이번 주는 주사 쉬어도 괜찮아요", "skip-dose"],
      ["약을 중단하세요", "medication-directive"],
      ["당뇨병입니다", "disease-assertion"],
      ["   ", "empty"],
    ];
    for (const [text, reason] of cases)
      expect(checkCoachMessage(text), text).toEqual({ ok: false, reason });
    expect(checkCoachMessage("가".repeat(1001))).toEqual({
      ok: false,
      reason: "too-long",
    });
    for (const reason of [
      "dose-number",
      "dose-change",
      "skip-dose",
      "medication-directive",
    ])
      expect(scopeReasonText[reason]).toBeTruthy();
  });

  it("약·용량 문의 감지", () => {
    expect(isMedicationQuestion("다음 주에 용량을 올려도 될까요?")).toBe(true);
    expect(isMedicationQuestion("주사 맞는 날을 바꿔도 되나요")).toBe(true);
    expect(isMedicationQuestion("오늘 점심 메뉴 추천해 주세요")).toBe(false);
    expect(isMedicationQuestion("식후 혈당이 190mg/dL이었어요")).toBe(false);
    expect(isMedicationQuestion("2.5mg 맞고 있어요")).toBe(true);
  });
});

describe("주간 피드백 초안", () => {
  const base: WeekSummary = {
    days: 7,
    checkInDays: 7,
    giModerateDays: 0,
    constipationDays: 0,
    avgAppetite: 5,
    mealCount: 18,
    mealDays: 7,
    avgProteinPerDay: 90,
    latestWeightKg: 80,
    weightChange: -0.6,
    tir: 92,
    avgMealRise: 30,
    adherenceRate: 1,
  };

  it("단백질 목표는 체중 1kg당 1.0g (5g 단위)", () => {
    expect(proteinTarget(82)).toBe(80);
    expect(proteinTarget(null)).toBeNull();
  });

  it("다룰 항목을 중요한 순으로 최대 3개, 없으면 격려", () => {
    expect(feedbackFocus(base)).toEqual(["keep-going"]);
    expect(
      feedbackFocus({
        ...base,
        avgProteinPerDay: 50,
        giModerateDays: 3,
        constipationDays: 2,
        avgMealRise: 70,
        checkInDays: 1,
      }),
    ).toEqual(["protein", "gi", "constipation"]);
  });

  it("초안은 기록 수치를 담고, AI 안전 검사 기준의 금지 표현이 없다", () => {
    const draft = weeklyFeedbackDraft("홍길동", {
      ...base,
      avgProteinPerDay: 50,
      giModerateDays: 2,
      avgMealRise: 60,
    });
    expect(draft).toContain("하루 평균 50g");
    expect(draft).toContain("하루 80g");
    expect(checkCoachMessage(draft)).toEqual({ ok: true });
    for (const line of draft.split("\n"))
      expect(checkText(line), line).toEqual({ ok: true });
  });

  it("안내 문구도 금지 표현 검사를 통과한다", () => {
    for (const t of [coachScopeNote, patientChatNote, MEDICATION_REPLY])
      for (const s of t.split(/(?<=[.요])\s+/))
        expect(checkText(s), s).toEqual({ ok: true });
  });
});

describe("주 시작", () => {
  it("한국 날짜 기준 월요일", () => {
    expect(weekStart("2026-10-20")).toBe("2026-10-19"); // 화 → 월
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // 일 → 같은 주 월
  });
});
