import type { DomainCode, DomainStatus } from "@/domain/analysis/types";

/** 10개 건강영역 — 사용자에게 보이는 이름과 쉬운 설명 */
export const domainContent: Record<
  DomainCode,
  { label: string; short: string; description: string; kind: "BODY" | "HABIT" }
> = {
  WEIGHT: {
    label: "체중건강",
    short: "체중·허리둘레",
    description: "키 대비 체중(BMI)과 허리둘레로 체형 상태를 살펴봅니다.",
    kind: "BODY",
  },
  METABOLIC: {
    label: "대사건강",
    short: "허리둘레·혈압·혈당·지질",
    description:
      "허리둘레, 혈압, 혈당, 중성지방, HDL을 함께 보고 몸의 에너지 처리 상태를 살펴봅니다.",
    kind: "BODY",
  },
  CARDIOVASCULAR: {
    label: "심혈관건강",
    short: "혈압·콜레스테롤·흡연",
    description:
      "혈압과 콜레스테롤, 흡연 여부로 심장과 혈관 관리 상태를 살펴봅니다.",
    kind: "BODY",
  },
  GLYCEMIC: {
    label: "혈당건강",
    short: "공복혈당·당화혈색소",
    description: "공복혈당과 당화혈색소로 혈당 관리 상태를 살펴봅니다.",
    kind: "BODY",
  },
  LIVER: {
    label: "간 건강",
    short: "AST·ALT·γ-GTP·음주",
    description: "간 효소 수치와 음주 습관을 함께 살펴봅니다.",
    kind: "BODY",
  },
  KIDNEY: {
    label: "신장 건강",
    short: "크레아티닌·eGFR",
    description: "신장이 노폐물을 걸러내는 능력과 관련된 수치를 살펴봅니다.",
    kind: "BODY",
  },
  EXERCISE: {
    label: "운동",
    short: "활동량·유산소·근력",
    description:
      "걸음 수, 유산소 운동 시간, 근력운동 여부로 활동량을 살펴봅니다.",
    kind: "HABIT",
  },
  SLEEP: {
    label: "수면",
    short: "수면시간·규칙성·만족도",
    description: "수면시간과 규칙성, 수면 만족도를 살펴봅니다.",
    kind: "HABIT",
  },
  DIET: {
    label: "식습관",
    short: "식사·야식·채소·단 음료",
    description:
      "아침식사, 야식, 채소·과일, 단 음료, 가공식품 섭취 습관을 살펴봅니다.",
    kind: "HABIT",
  },
  LIFESTYLE: {
    label: "생활습관",
    short: "음주·흡연·스트레스",
    description: "음주, 흡연, 스트레스 정도를 살펴봅니다.",
    kind: "HABIT",
  },
};

/**
 * 상태 표시 — 색상만으로 구분하지 않도록 라벨 + 점(●) + 아이콘을 함께 사용한다.
 * dots: 관리 필요도 (많을수록 관리가 더 필요)
 */
export const statusContent: Record<
  DomainStatus,
  {
    label: string;
    dots: number | null;
    icon: string;
    tone: string;
    meaning: string;
  }
> = {
  GOOD: {
    label: "양호",
    dots: 1,
    icon: "◎",
    tone: "text-emerald-800 bg-emerald-50 border-emerald-200",
    meaning: "지금처럼 유지하면 좋아요.",
  },
  NORMAL: {
    label: "보통",
    dots: 2,
    icon: "○",
    tone: "text-sky-800 bg-sky-50 border-sky-200",
    meaning: "큰 문제는 없지만 조금 더 좋아질 여지가 있어요.",
  },
  ATTENTION: {
    label: "관심",
    dots: 3,
    icon: "△",
    tone: "text-amber-800 bg-amber-50 border-amber-200",
    meaning: "관심을 갖고 생활습관을 살펴보면 좋아요.",
  },
  MANAGEMENT_NEEDED: {
    label: "관리 필요",
    dots: 4,
    icon: "!",
    tone: "text-rose-800 bg-rose-50 border-rose-200",
    meaning: "적극적으로 관리하는 것을 권장해요.",
  },
  DATA_INSUFFICIENT: {
    label: "데이터 부족",
    dots: null,
    icon: "?",
    tone: "text-slate-700 bg-slate-100 border-slate-200",
    meaning: "입력된 정보가 부족해 판단하기 어려워요.",
  },
};
