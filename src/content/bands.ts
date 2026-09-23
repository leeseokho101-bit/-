import type { Band } from "@/domain/analysis/types";

/** 지표 구간 표시 — 색상 + 아이콘 + 글자를 함께 사용 */
export const bandContent: Record<
  Band,
  { label: string; icon: string; tone: string }
> = {
  OPTIMAL: { label: "좋음", icon: "◎", tone: "text-emerald-800 bg-emerald-50" },
  NORMAL: { label: "정상", icon: "○", tone: "text-sky-800 bg-sky-50" },
  BORDERLINE: { label: "경계", icon: "△", tone: "text-amber-800 bg-amber-50" },
  ELEVATED: { label: "관리 필요", icon: "!", tone: "text-rose-800 bg-rose-50" },
};

/**
 * 주요 건강 데이터의 참고 범위 (사용자 안내용, docs/RULES_REFERENCE.md 기준)
 * 성별에 따라 다른 항목은 sex별로 둔다.
 */
export const keyMetricGuides: {
  item: string;
  label: string;
  guide: string | { MALE: string; FEMALE: string };
}[] = [
  { item: "BMI", label: "체질량지수(BMI)", guide: "18.5~22.9" },
  {
    item: "WAIST",
    label: "허리둘레",
    guide: { MALE: "90cm 미만", FEMALE: "85cm 미만" },
  },
  { item: "BP", label: "혈압", guide: "120/80 mmHg 미만" },
  { item: "FASTING_GLUCOSE", label: "공복혈당", guide: "100 mg/dL 미만" },
  { item: "HBA1C", label: "당화혈색소", guide: "5.7% 미만" },
  { item: "LDL", label: "LDL 콜레스테롤", guide: "130 mg/dL 미만" },
  {
    item: "HDL",
    label: "HDL 콜레스테롤",
    guide: "40 mg/dL 이상 (60 이상 좋음)",
  },
  { item: "TRIGLYCERIDE", label: "중성지방", guide: "150 mg/dL 미만" },
  { item: "ALT", label: "ALT (간 수치)", guide: "40 U/L 이하" },
  {
    item: "EGFR",
    label: "사구체여과율(eGFR)",
    guide: "60 이상 (90 이상 좋음)",
  },
];
