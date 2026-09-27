/**
 * 생체나이 화면 문구
 * - 진단·질병 가능성 표현 금지. "판정 기준에 도달" 처럼 기준 대비 위치로만 설명한다.
 * - 약 복용 변경을 권하지 않는다.
 */
import type {
  BioAgeResult,
  MetabolicFactorCode,
  OrganAge,
  OrganCode,
} from "@/domain/bio-age/types";
import { THERAPY_LABELS, type Therapy } from "@/domain/medication/catalog";

export const organContent: Record<
  OrganCode,
  { label: string; icon: string; description: string; metricsText: string }
> = {
  LIVER: {
    label: "간나이",
    icon: "🫘",
    description: "간 효소 수치를 같은 성별·나이 평균과 비교했어요.",
    metricsText: "ALT · γ-GTP · AST",
  },
  VASCULAR: {
    label: "혈관나이",
    icon: "🩸",
    description: "혈관 건강과 관련된 콜레스테롤·중성지방을 비교했어요.",
    metricsText: "LDL · HDL · 중성지방 · 총콜레스테롤",
  },
  BLOOD_PRESSURE: {
    label: "혈압나이",
    icon: "💓",
    description: "수축기·이완기 혈압을 비교했어요.",
    metricsText: "수축기 · 이완기 혈압",
  },
  KIDNEY: {
    label: "신장나이",
    icon: "🫧",
    description:
      "신장이 노폐물을 거르는 능력(eGFR)을 비교했어요. eGFR이 없으면 크레아티닌으로 계산해요.",
    metricsText: "eGFR (크레아티닌)",
  },
  DIABETES: {
    label: "당뇨나이",
    icon: "🍬",
    description: "공복혈당과 당화혈색소를 비교했어요.",
    metricsText: "공복혈당 · 당화혈색소",
  },
  ANEMIA: {
    label: "빈혈나이",
    icon: "🔴",
    description:
      "혈색소(헤모글로빈)를 비교했어요. 낮을수록 나이가 많게 나와요.",
    metricsText: "혈색소",
  },
  METABOLIC: {
    label: "대사증후군 나이",
    icon: "⚖️",
    description:
      "대사증후군 판정 기준 5개 요소(허리둘레·혈압·공복혈당·중성지방·HDL)를 비교했어요.",
    metricsText: "허리둘레 · 혈압 · 공복혈당 · 중성지방 · HDL",
  },
};

export const metabolicFactorLabels: Record<MetabolicFactorCode, string> = {
  WAIST: "허리둘레",
  BLOOD_PRESSURE: "혈압",
  GLUCOSE: "공복혈당",
  TRIGLYCERIDE: "중성지방",
  HDL: "HDL 콜레스테롤",
};

/** 나이 차이 → "+2세" / "-1세" / "±0세" */
export function formatGap(gap: number): string {
  const r = Math.round(gap);
  if (r === 0) return "±0세";
  return r > 0 ? `+${r}세` : `${r}세`;
}

export function formatAge(age: number): string {
  return `${Math.round(age)}세`;
}

/** 나이 차이에 따른 표시 톤 (색만으로 구분하지 않도록 글자 라벨도 함께) */
export function gapTone(gap: number | null): {
  label: string;
  tone: string;
} {
  if (gap === null)
    return {
      label: "입력 부족",
      tone: "text-slate-700 bg-slate-100 border-slate-200",
    };
  const r = Math.round(gap);
  if (r <= -2)
    return {
      label: "또래보다 젊음",
      tone: "text-emerald-800 bg-emerald-50 border-emerald-200",
    };
  if (r <= 1)
    return {
      label: "또래와 비슷",
      tone: "text-sky-800 bg-sky-50 border-sky-200",
    };
  if (r <= 5)
    return {
      label: "관심 필요",
      tone: "text-amber-800 bg-amber-50 border-amber-200",
    };
  return {
    label: "관리 필요",
    tone: "text-rose-800 bg-rose-50 border-rose-200",
  };
}

/** 약 복용 보정 설명 */
export function medicationNote(organ: OrganAge): string | null {
  if (organ.medication === "NONE" || organ.status !== "OK") return null;
  const therapyText =
    organ.organ === "METABOLIC"
      ? "혈압약·당뇨약·고지혈증약"
      : THERAPY_LABELS[organ.therapy as Therapy];
  if (organ.medication === "UNQUANTIFIED")
    return `${therapyText}을 복용 중이지만 성분·함량 정보가 없어 보정하지 못했어요. 복용약 단계에서 성분·함량을 고르면 보정돼요.`;
  const diff = Math.round(organ.adjustedGap! - organ.measuredGap!);
  if (diff === 0)
    return `${therapyText}의 평균적인 효과를 반영해도 나이 차이는 같아요.`;
  return `${therapyText}이 수치를 낮춰 주는 평균 범위를 반영하면 ${formatGap(organ.measuredGap!)} → ${formatGap(organ.adjustedGap!)}로 보정돼요.`;
}

/** 대사증후군 판정 기준 도달 시점 추정 문구 */
export function projectionText(result: BioAgeResult): {
  title: string;
  body: string;
} {
  const p = result.metabolic.projection;
  const metAge = result.organs.find(
    (o) => o.organ === "METABOLIC",
  )?.adjustedAge;
  switch (p.status) {
    case "DATA_INSUFFICIENT":
      return {
        title: "추정하려면 입력이 더 필요해요",
        body: "허리둘레·혈압·공복혈당·중성지방·HDL 중 3개 이상을 입력하면 판정 기준 도달 시점을 추정할 수 있어요.",
      };
    case "ALREADY_MET":
      return {
        title: `현재 판정 기준 요소 ${p.metCount}개에 해당해요`,
        body: "대사증후군 판정 기준(5개 요소 중 3개 이상)에 이미 해당하는 수치예요. 정확한 판단은 의료진과 상담해 주세요. 허리둘레·혈압·혈당 관리를 함께 시작하면 요소를 줄여 나갈 수 있어요.",
      };
    case "PROJECTED":
      return {
        title: `약 ${p.yearsUntil}년 뒤 (${p.atAge}세 무렵)`,
        body: `지금 생활습관이 그대로라면 대사증후군 나이 ${metAge !== undefined && metAge !== null ? formatAge(metAge) : ""}의 진행 속도로 약 ${p.yearsUntil}년 뒤 판정 기준(5개 요소 중 3개 이상)에 도달할 수 있다고 추정돼요. 생활습관을 바꾸면 이 시점을 늦출 수 있어요.`,
      };
    case "NOT_WITHIN_HORIZON":
      return {
        title: `앞으로 ${p.horizonYears}년 안에는 도달하지 않을 것으로 추정돼요`,
        body: "지금 수치와 대사증후군 나이 기준으로는 판정 기준(5개 요소 중 3개 이상)까지 여유가 있어요. 지금의 좋은 습관을 유지해 주세요.",
      };
  }
}

export const bioAgeDisclaimer =
  "생체나이는 같은 성별·나이의 평균 수치와 비교해 나이로 바꿔 본 참고 지표이며 의학적 진단이 아닙니다. 약 보정은 임상연구의 평균 효과를 적용한 추정으로 개인마다 다를 수 있고, 약 복용·변경은 반드시 의료진과 상의해 주세요.";
