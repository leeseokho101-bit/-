/**
 * 12주 계획 실천 항목 라이브러리 (생활습관 중심, 약·치료 관련 항목 없음)
 * 영역 × 단계마다 2개 — 단계 앞 2주는 첫 번째, 뒤 2주는 두 개 모두 실천 (점진적 확대)
 */
import type { DomainCode } from "@/domain/analysis/types";

export type PlanPhase = "FOUNDATION" | "ACTIVATION" | "MAINTENANCE";

export type ActionTemplate = { key: string; text: string; check: string };

export const phaseInfo: Record<
  PlanPhase,
  { weeks: [number, number]; title: string; goal: string }
> = {
  FOUNDATION: {
    weeks: [1, 4],
    title: "기초 생활습관 개선",
    goal: "부담 없는 작은 습관으로 생활 리듬을 만들어요.",
  },
  ACTIVATION: {
    weeks: [5, 8],
    title: "운동 및 식습관 개선",
    goal: "몸을 더 움직이고 식습관을 한 단계 개선해요.",
  },
  MAINTENANCE: {
    weeks: [9, 12],
    title: "생활습관 유지 및 변화 평가",
    goal: "만든 습관을 유지하고 달라진 점을 확인해요.",
  },
};

export function phaseOf(week: number): PlanPhase {
  return week <= 4 ? "FOUNDATION" : week <= 8 ? "ACTIVATION" : "MAINTENANCE";
}

const a = (key: string, text: string, check: string): ActionTemplate => ({
  key,
  text,
  check,
});

export const actionLibrary: Record<
  DomainCode,
  Record<PlanPhase, [ActionTemplate, ActionTemplate]>
> = {
  WEIGHT: {
    FOUNDATION: [
      a(
        "weight.f1",
        "저녁 식사량을 평소보다 한두 숟가락 줄이기",
        "저녁 식사량을 줄인 날이 주 4일 이상이었나요?",
      ),
      a(
        "weight.f2",
        "주 1회 같은 요일 아침에 체중 재기",
        "이번 주 체중을 재고 기록했나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "weight.a1",
        "식사 후 15~20분 걷기 주 5일",
        "식후 걷기를 주 5일 이상 했나요?",
      ),
      a(
        "weight.a2",
        "간식을 과일·견과류 한 줌으로 바꾸기",
        "간식을 건강한 것으로 바꾼 날이 주 4일 이상이었나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "weight.m1",
        "걷기와 식사량 조절 습관 유지하기",
        "식사량 조절과 걷기를 주 5일 이상 유지했나요?",
      ),
      a(
        "weight.m2",
        "체중·허리둘레를 재서 처음과 비교하기",
        "체중과 허리둘레를 재서 기록했나요?",
      ),
    ],
  },
  METABOLIC: {
    FOUNDATION: [
      a(
        "metabolic.f1",
        "단 음료를 물·보리차로 바꾸기",
        "단 음료 대신 물을 마신 날이 주 5일 이상이었나요?",
      ),
      a(
        "metabolic.f2",
        "밤 9시 이후 먹지 않기",
        "밤 9시 이후 먹지 않은 날이 주 5일 이상이었나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "metabolic.a1",
        "하루 30분 빠르게 걷기 주 5일",
        "30분 걷기를 주 5일 이상 했나요?",
      ),
      a(
        "metabolic.a2",
        "한 끼는 잡곡밥과 채소 반찬으로 먹기",
        "잡곡밥·채소 반찬으로 먹은 날이 주 5일 이상이었나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "metabolic.m1",
        "걷기·식습관 유지하기",
        "걷기와 식습관을 주 5일 이상 유지했나요?",
      ),
      a(
        "metabolic.m2",
        "허리둘레를 재서 처음과 비교하기",
        "허리둘레를 재서 기록했나요?",
      ),
    ],
  },
  CARDIOVASCULAR: {
    FOUNDATION: [
      a(
        "cardio.f1",
        "국물은 반만 먹고 짠 반찬 줄이기",
        "국물·짠 반찬을 줄인 날이 주 5일 이상이었나요?",
      ),
      a(
        "cardio.f2",
        "가능하면 집에서 혈압 재서 기록하기",
        "이번 주 혈압을 재고 기록했나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "cardio.a1",
        "하루 30분 빠르게 걷기 주 5일",
        "30분 걷기를 주 5일 이상 했나요?",
      ),
      a(
        "cardio.a2",
        "튀김·기름진 음식 대신 굽거나 찐 음식 고르기",
        "기름진 음식을 줄인 날이 주 4일 이상이었나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "cardio.m1",
        "싱겁게 먹기와 걷기 유지하기",
        "싱겁게 먹기와 걷기를 주 5일 이상 유지했나요?",
      ),
      a(
        "cardio.m2",
        "혈압 기록을 모아 처음과 비교하기",
        "혈압을 재서 기록했나요?",
      ),
    ],
  },
  GLYCEMIC: {
    FOUNDATION: [
      a(
        "glycemic.f1",
        "단 음료·달달한 커피를 물이나 차로 바꾸기",
        "단 음료 대신 물·차를 마신 날이 주 5일 이상이었나요?",
      ),
      a(
        "glycemic.f2",
        "식사 후 10분 가볍게 걷기",
        "식후 10분 걷기를 주 4일 이상 했나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "glycemic.a1",
        "흰쌀·빵 대신 잡곡밥·통곡물 먹기",
        "잡곡·통곡물로 먹은 날이 주 5일 이상이었나요?",
      ),
      a(
        "glycemic.a2",
        "식사 후 15분 걷기 주 5일",
        "식후 15분 걷기를 주 5일 이상 했나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "glycemic.m1",
        "잡곡밥·식후 걷기 습관 유지하기",
        "잡곡밥과 식후 걷기를 주 5일 이상 유지했나요?",
      ),
      a(
        "glycemic.m2",
        "다음 검진 때 공복혈당·당화혈색소 확인 계획 세우기",
        "다음 검진 일정을 확인했나요?",
      ),
    ],
  },
  LIVER: {
    FOUNDATION: [
      a(
        "liver.f1",
        "술 마시는 날을 일주일에 하루 줄이기",
        "술 마신 날이 지난주보다 줄었나요?",
      ),
      a(
        "liver.f2",
        "야식·기름진 안주 줄이기",
        "야식을 먹지 않은 날이 주 5일 이상이었나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "liver.a1",
        "한 번에 마시는 양을 절반으로 줄이기",
        "한 번에 마시는 양을 줄였나요?",
      ),
      a("liver.a2", "하루 30분 걷기 주 5일", "30분 걷기를 주 5일 이상 했나요?"),
    ],
    MAINTENANCE: [
      a("liver.m1", "절주·걷기 습관 유지하기", "절주와 걷기를 유지했나요?"),
      a(
        "liver.m2",
        "다음 검진 때 간 수치 확인 계획 세우기",
        "다음 검진 일정을 확인했나요?",
      ),
    ],
  },
  KIDNEY: {
    FOUNDATION: [
      a(
        "kidney.f1",
        "싱겁게 먹기 (국·찌개 국물 줄이기)",
        "싱겁게 먹은 날이 주 5일 이상이었나요?",
      ),
      a(
        "kidney.f2",
        "물을 하루 5~6잔 나눠 마시기",
        "물을 충분히 마신 날이 주 5일 이상이었나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "kidney.a1",
        "가공식품·인스턴트 음식 줄이기",
        "가공식품을 먹지 않은 날이 주 5일 이상이었나요?",
      ),
      a(
        "kidney.a2",
        "하루 30분 걷기 주 5일",
        "30분 걷기를 주 5일 이상 했나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "kidney.m1",
        "싱겁게 먹기·걷기 유지하기",
        "싱겁게 먹기와 걷기를 유지했나요?",
      ),
      a(
        "kidney.m2",
        "다음 검진 때 신장 수치 확인 계획 세우기",
        "다음 검진 일정을 확인했나요?",
      ),
    ],
  },
  EXERCISE: {
    FOUNDATION: [
      a(
        "exercise.f1",
        "하루 걸음 수를 지금보다 1,000보 늘리기",
        "걸음 수를 늘린 날이 주 5일 이상이었나요?",
      ),
      a(
        "exercise.f2",
        "엘리베이터 대신 계단 2~3층 이용하기",
        "계단을 이용한 날이 주 3일 이상이었나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "exercise.a1",
        "빠르게 걷기 30분 주 5일 (주 150분)",
        "빠르게 걷기를 주 150분 이상 했나요?",
      ),
      a(
        "exercise.a2",
        "스쿼트·벽 팔굽혀펴기 등 근력운동 주 2회",
        "근력운동을 주 2회 이상 했나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "exercise.m1",
        "주 150분 걷기 유지하기",
        "걷기를 주 150분 이상 유지했나요?",
      ),
      a(
        "exercise.m2",
        "근력운동 주 2회 유지하기",
        "근력운동을 주 2회 이상 했나요?",
      ),
    ],
  },
  SLEEP: {
    FOUNDATION: [
      a(
        "sleep.f1",
        "매일 같은 시간에 잠자리에 들기",
        "같은 시간에 잠든 날이 주 5일 이상이었나요?",
      ),
      a(
        "sleep.f2",
        "잠들기 1시간 전 휴대폰·TV 끄기",
        "잠들기 전 화면을 끈 날이 주 4일 이상이었나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "sleep.a1",
        "오후 2시 이후 카페인 음료 피하기",
        "오후 카페인을 피한 날이 주 5일 이상이었나요?",
      ),
      a(
        "sleep.a2",
        "아침 햇볕 쬐며 10분 걷기",
        "아침 햇볕 걷기를 주 4일 이상 했나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "sleep.m1",
        "규칙적인 수면 시간 유지하기",
        "규칙적인 수면을 주 5일 이상 유지했나요?",
      ),
      a(
        "sleep.m2",
        "수면 만족도를 처음과 비교해 보기",
        "이번 주 수면이 처음보다 나아졌나요?",
      ),
    ],
  },
  DIET: {
    FOUNDATION: [
      a(
        "diet.f1",
        "하루 한 끼는 채소 반찬 두 가지 이상 곁들이기",
        "채소 반찬을 챙긴 날이 주 5일 이상이었나요?",
      ),
      a(
        "diet.f2",
        "아침을 간단히라도 챙겨 먹기",
        "아침을 먹은 날이 주 5일 이상이었나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "diet.a1",
        "외식·배달을 주 2회 이하로 줄이기",
        "외식·배달이 주 2회 이하였나요?",
      ),
      a(
        "diet.a2",
        "라면·햄 같은 가공식품을 주 1회 이하로 줄이기",
        "가공식품이 주 1회 이하였나요?",
      ),
    ],
    MAINTENANCE: [
      a(
        "diet.m1",
        "채소·아침 챙기기 유지하기",
        "채소와 아침을 주 5일 이상 챙겼나요?",
      ),
      a(
        "diet.m2",
        "외식·가공식품 줄이기 유지하기",
        "외식·가공식품을 줄인 상태를 유지했나요?",
      ),
    ],
  },
  LIFESTYLE: {
    FOUNDATION: [
      a(
        "lifestyle.f1",
        "하루 10분 나만의 휴식 시간 갖기 (산책·호흡·스트레칭)",
        "휴식 시간을 가진 날이 주 5일 이상이었나요?",
      ),
      a(
        "lifestyle.f2",
        "술 마시는 날 하루 줄이기",
        "술 마신 날이 지난주보다 줄었나요?",
      ),
    ],
    ACTIVATION: [
      a(
        "lifestyle.a1",
        "금연 중이거나 흡연량 줄이기 (보건소 금연클리닉 알아보기)",
        "흡연량을 줄이거나 금연을 이어갔나요?",
      ),
      a(
        "lifestyle.a2",
        "한 번에 마시는 술의 양 줄이기",
        "한 번에 마시는 양을 줄였나요?",
      ),
    ],
    MAINTENANCE: [
      a("lifestyle.m1", "금연·절주 상태 유지하기", "금연·절주를 유지했나요?"),
      a(
        "lifestyle.m2",
        "스트레스 관리 시간 유지하기",
        "휴식 시간을 주 5일 이상 가졌나요?",
      ),
    ],
  },
};

/** 공통 항목: 처음 기록, 중간 점검, 마지막 재분석 */
export const milestoneActions: Record<number, ActionTemplate> = {
  1: a(
    "common.baseline",
    "지금 체중·허리둘레를 재서 시작 기록 남기기",
    "시작 체중을 기록했나요?",
  ),
  8: a(
    "common.midpoint",
    "중간 점검: 체중 재고 지난 7주 돌아보기",
    "중간 점검을 했나요?",
  ),
  12: a(
    "common.reassess",
    "12주 마무리: 다시 건강분석 하기 (최근 검진 결과가 있다면 입력)",
    "다시 건강분석을 했거나 계획을 세웠나요?",
  ),
};
