/**
 * 주간 코칭 피드백 초안 (규칙 기반, 결정적). 코치가 읽고 고친 뒤 보낸다.
 * 생활습관(식사·단백질·활동·기록)만 다루고 약·진단은 다루지 않는다.
 *
 * 단백질 목표: 감량 중 근육 유지를 위해 체중 1kg당 하루 1.0g 이상 (초안, 영양 자문 필요)
 */
export type WeekSummary = {
  days: number;
  checkInDays: number;
  /** 메스꺼움·구토·설사·복통 중 하나라도 "보통" 이상인 날 */
  giModerateDays: number;
  constipationDays: number;
  avgAppetite: number | null;
  mealCount: number;
  mealDays: number;
  avgProteinPerDay: number | null;
  latestWeightKg: number | null;
  weightChange: number | null;
  tir: number | null;
  avgMealRise: number | null;
  adherenceRate: number | null;
};

export const PROTEIN_G_PER_KG = 1.0;
export const LARGE_MEAL_RISE = 50;

export function proteinTarget(weightKg: number | null): number | null {
  return weightKg ? Math.round((weightKg * PROTEIN_G_PER_KG) / 5) * 5 : null;
}

export type FeedbackFocus =
  "protein" | "gi" | "constipation" | "meal-rise" | "logging" | "keep-going";

/** 이번 주 피드백에서 다룰 항목 (중요한 순, 최대 3개) */
export function feedbackFocus(s: WeekSummary): FeedbackFocus[] {
  const out: FeedbackFocus[] = [];
  const target = proteinTarget(s.latestWeightKg);
  if (
    s.avgProteinPerDay !== null &&
    target !== null &&
    s.avgProteinPerDay < target
  )
    out.push("protein");
  if (s.giModerateDays >= 2) out.push("gi");
  if (s.constipationDays >= 2) out.push("constipation");
  if (s.avgMealRise !== null && s.avgMealRise >= LARGE_MEAL_RISE)
    out.push("meal-rise");
  if (
    s.checkInDays < Math.ceil(s.days / 2) ||
    s.mealDays < Math.ceil(s.days / 2)
  )
    out.push("logging");
  return out.length ? out.slice(0, 3) : ["keep-going"];
}

export function weeklyFeedbackDraft(name: string, s: WeekSummary): string {
  const lines: string[] = [`${name}님, 이번 주도 기록해 주셔서 고마워요.`];
  const facts: string[] = [];
  facts.push(`체크인 ${s.checkInDays}일`);
  if (s.mealCount) facts.push(`식사 ${s.mealCount}끼`);
  if (s.weightChange !== null)
    facts.push(`체중 ${s.weightChange > 0 ? "+" : ""}${s.weightChange}kg`);
  if (s.tir !== null) facts.push(`혈당 목표 범위 ${s.tir}%`);
  lines.push(`지난 ${s.days}일 기록: ${facts.join(", ")}.`);

  const target = proteinTarget(s.latestWeightKg);
  for (const f of feedbackFocus(s)) {
    switch (f) {
      case "protein":
        lines.push(
          `단백질은 하루 평균 ${s.avgProteinPerDay}g이었어요. 근육을 지키려면 하루 ${target}g 정도가 좋아요. 끼니마다 달걀·두부·생선·살코기를 손바닥 크기만큼 먼저 드셔 보세요.`,
        );
        break;
      case "gi":
        lines.push(
          `속이 불편한 날이 ${s.giModerateDays}일 있었어요. 한 번에 조금씩 천천히, 기름진 음식은 줄이고 배부르기 전에 멈춰 보세요. 계속되면 담당 의원과 상의해 주세요.`,
        );
        break;
      case "constipation":
        lines.push(
          "변비가 있었던 날이 많았어요. 물을 자주 드시고, 채소·잡곡과 식후 가벼운 걷기를 더해 보세요.",
        );
        break;
      case "meal-rise":
        lines.push(
          `식후 혈당이 평균 ${s.avgMealRise}mg/dL 올랐어요. 채소·단백질을 먼저, 밥은 나중에 드시고 식후 10~15분 걸어 보세요.`,
        );
        break;
      case "logging":
        lines.push(
          "이번 주는 기록이 조금 적었어요. 하루 1분 체크인과 식사 사진 한 장부터 다시 시작해 봐요.",
        );
        break;
      case "keep-going":
        lines.push(
          "식사·기록 모두 잘하고 계세요. 지금처럼 단백질 챙기기와 꾸준한 걷기를 이어가 봐요.",
        );
        break;
    }
  }
  lines.push("이번 주 목표 하나를 정해 답장으로 알려 주시면 함께 챙길게요.");
  return lines.join("\n");
}
