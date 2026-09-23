/**
 * 12주 건강관리 계획 생성 (결정적: 같은 분석 결과 → 같은 계획)
 * TOP 3 영역의 실천 항목을 단계별로 조립한다. 코칭 문구는 템플릿 기본값이며, LLM이 있으면 교체될 수 있다.
 */
import { domainContent } from "@/content/domains";
import type {
  AnalysisOutput,
  DomainCode,
  DomainResult,
} from "@/domain/analysis/types";
import { josa } from "@/lib/josa";
import {
  actionLibrary,
  milestoneActions,
  phaseInfo,
  phaseOf,
  type ActionTemplate,
  type PlanPhase,
} from "./library";

export const PLAN_WEEKS = 12;

export type PlanAction = {
  id: string;
  domain: DomainCode | null;
  text: string;
};
export type PlanCheck = { id: string; label: string };

export type PlanWeekDraft = {
  weekNumber: number;
  phase: PlanPhase;
  goal: string;
  actions: PlanAction[];
  checks: PlanCheck[];
  coaching: string;
};

const DEFAULT_FOCUS: DomainCode[] = ["EXERCISE", "SLEEP", "DIET"];

/** 입력 내용에 맞지 않는 항목 교체 (예: 비흡연자에게 금연 항목 제외) */
function adapt(
  domain: DomainResult | undefined,
  t: ActionTemplate,
): ActionTemplate {
  if (domain?.domain !== "LIFESTYLE") return t;
  const keys = new Set(domain.findings.map((f) => f.messageKey));
  const smokes = keys.has("lifestyle.smoking.current");
  const drinksALot =
    keys.has("lifestyle.alcohol.frequent") ||
    keys.has("lifestyle.alcohol.highRisk");
  if (t.key === "lifestyle.a1" && !smokes) {
    return {
      key: "lifestyle.a1s",
      text: "하루 20분 산책하며 스트레스 풀기",
      check: "산책을 주 4일 이상 했나요?",
    };
  }
  if ((t.key === "lifestyle.f2" || t.key === "lifestyle.a2") && !drinksALot) {
    return t.key === "lifestyle.f2"
      ? {
          key: "lifestyle.f2s",
          text: "잠들기 전 5분 복식호흡 하기",
          check: "복식호흡을 주 4일 이상 했나요?",
        }
      : {
          key: "lifestyle.a2s",
          text: "마음이 편해지는 취미 활동 주 1회 이상",
          check: "취미 활동을 했나요?",
        };
  }
  if (t.key === "lifestyle.m1" && !smokes && !drinksALot) {
    return {
      key: "lifestyle.m1s",
      text: "산책·호흡 등 나만의 휴식 습관 유지하기",
      check: "휴식 습관을 유지했나요?",
    };
  }
  return t;
}

const COACHING: Record<PlanPhase, string[]> = {
  FOUNDATION: [
    "첫 주예요. 완벽하게 하려 하기보다 {d1} 실천 한 가지를 꾸준히 해보는 데 집중해 보세요.",
    "작은 습관이 쌓이는 중이에요. 실천하지 못한 날이 있어도 괜찮아요. 다음 날 다시 시작하면 됩니다.",
    "이번 주부터 실천 항목이 하나씩 늘어요. 이미 익숙해진 습관과 함께 묶어서 해보세요.",
    "기초 단계의 마지막 주예요. 지난 4주 동안 가장 잘 지킨 습관을 떠올려 보세요. 그 습관이 다음 단계의 힘이 됩니다.",
  ],
  ACTIVATION: [
    "이제 몸을 조금 더 움직이고 식습관을 한 단계 바꿔 보는 시기예요. 무리하지 말고 할 수 있는 만큼부터 시작해요.",
    "새로운 실천이 어렵게 느껴진다면 시간을 정해 두는 것이 도움이 돼요. 예를 들어 '저녁 식사 후 바로'처럼요.",
    "한 달 넘게 꾸준히 하고 계세요. 함께 실천할 가족이나 친구가 있다면 더 오래 이어가기 쉬워요.",
    "중간 점검 주예요. 체중을 재 보고 처음과 비교해 보세요. 숫자보다 몸이 가벼워진 느낌도 중요한 변화예요.",
  ],
  MAINTENANCE: [
    "지금까지 만든 습관을 유지하는 단계예요. 새로운 것을 더하기보다 이어가는 데 집중해요.",
    "바쁜 주에는 실천이 줄 수 있어요. 가장 중요한 한 가지, {d1} 실천만큼은 지켜 보세요.",
    "거의 다 왔어요. 12주 전과 비교해 달라진 점을 적어 보면 큰 동기가 됩니다.",
    "12주를 마무리하는 주예요. 다시 건강분석을 해서 변화를 확인하고, 최근 검진 결과가 있다면 함께 입력해 보세요. 정확한 판단은 의료진과 상담하시기 바랍니다.",
  ],
};

export function templateCoaching(week: number, focus: DomainCode[]): string {
  const phase = phaseOf(week);
  const msg = COACHING[phase][(week - 1) % 4];
  return msg.replace("{d1}", domainContent[focus[0]].label);
}

export function buildCarePlan(output: AnalysisOutput): {
  focus: DomainCode[];
  weeks: PlanWeekDraft[];
} {
  const byCode = new Map(output.domains.map((d) => [d.domain, d]));
  const focus = output.priorities.length
    ? output.priorities.map((p) => p.domain)
    : DEFAULT_FOCUS;
  const focusLabels = focus.map((d) => domainContent[d].label).join(", ");

  const weeks: PlanWeekDraft[] = [];
  for (let week = 1; week <= PLAN_WEEKS; week++) {
    const phase = phaseOf(week);
    const inPhase = week - phaseInfo[phase].weeks[0]; // 0..3
    const templates: { domain: DomainCode | null; t: ActionTemplate }[] = [];
    for (const d of focus) {
      const [first, second] = actionLibrary[d][phase];
      templates.push({ domain: d, t: adapt(byCode.get(d), first) });
      if (inPhase >= 2)
        templates.push({ domain: d, t: adapt(byCode.get(d), second) });
    }
    if (milestoneActions[week])
      templates.unshift({ domain: null, t: milestoneActions[week] });

    // 같은 실천이 여러 영역에서 겹치면 한 번만 (예: 30분 걷기)
    const seen = new Set<string>();
    const unique = templates.filter(({ t }) =>
      seen.has(t.text) ? false : (seen.add(t.text), true),
    );

    weeks.push({
      weekNumber: week,
      phase,
      goal: `${phaseInfo[phase].title} — ${josa(focusLabels, "을/를")} 중심으로 ${phaseInfo[phase].goal}`,
      actions: unique.map(({ domain, t }) => ({
        id: `w${week}.${t.key}`,
        domain,
        text: t.text,
      })),
      checks: unique.map(({ t }) => ({
        id: `w${week}.${t.key}`,
        label: t.check,
      })),
      coaching: templateCoaching(week, focus),
    });
  }
  return { focus, weeks };
}

/** 계획 시작일 기준 현재 주차 (1~12) */
export function currentWeekOf(startDate: Date, today: Date): number {
  const days = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
  return Math.min(PLAN_WEEKS, Math.max(1, Math.floor(days / 7) + 1));
}

/** 주간 체크 결과에 대한 피드백 (템플릿, 결정적) */
export function weeklyFeedback(
  rate: number,
  previousRate: number | null,
): string {
  const pct = Math.round(rate * 100);
  let msg: string;
  if (rate >= 0.8)
    msg = `이번 주 실천율 ${pct}%, 정말 잘하고 계세요! 지금의 리듬을 그대로 이어가 보세요.`;
  else if (rate >= 0.5)
    msg = `이번 주 실천율 ${pct}%예요. 절반 이상 해내셨어요. 놓친 항목 중 가장 쉬운 하나부터 다시 챙겨 보세요.`;
  else if (rate > 0)
    msg = `이번 주 실천율 ${pct}%예요. 바쁜 한 주였나요? 다음 주에는 한 가지만 골라 꾸준히 해보는 것을 목표로 해요.`;
  else
    msg =
      "이번 주는 실천이 어려웠군요. 괜찮아요. 다음 주에 가장 쉬운 한 가지부터 다시 시작해 봐요.";
  if (previousRate !== null && rate > previousRate + 0.1)
    msg += " 지난주보다 실천율이 올랐어요.";
  return msg;
}
