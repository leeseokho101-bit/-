/**
 * GLP-1 계열 약 카탈로그 (중립성 원칙: 특정 제품만 지원하지 않는다).
 *
 * - 앱은 담당 의사가 정한 용량·일정을 "기록"만 한다. 용량 단계 목록은 입력 편의용이며,
 *   다음 단계를 제안하거나 증량 시점을 판단하지 않는다.
 * - 제품명은 사용자가 자신의 처방을 고르기 위한 목록에만 쓰고, 성분 순으로 나란히 보여준다
 *   (광고 목적 노출 금지 — docs/PRIVACY_AND_COMPLIANCE.md).
 * - 용량 단계는 국내 허가사항의 표준 증량 단계를 옮긴 것으로, 출시 전 약사·의학 감수가 필요하다.
 */
export type DrugRoute = "INJECTION" | "ORAL";

export type DrugInfo = {
  code: string;
  /** 성분명 */
  ingredient: string;
  /** 제품명 (사용자가 처방을 고르기 위한 표시용) */
  product: string;
  route: DrugRoute;
  /** 투약 간격 (일) */
  intervalDays: 1 | 7;
  /** 표준 용량 단계 (mg). 비어 있으면 직접 입력 */
  doseSteps: readonly number[];
};

export const DRUGS = [
  {
    code: "SEMAGLUTIDE_WEEKLY_OB",
    ingredient: "세마글루타이드",
    product: "위고비",
    route: "INJECTION",
    intervalDays: 7,
    doseSteps: [0.25, 0.5, 1, 1.7, 2.4],
  },
  {
    code: "SEMAGLUTIDE_WEEKLY_DM",
    ingredient: "세마글루타이드",
    product: "오젬픽",
    route: "INJECTION",
    intervalDays: 7,
    doseSteps: [0.25, 0.5, 1, 2],
  },
  {
    code: "SEMAGLUTIDE_ORAL",
    ingredient: "세마글루타이드(먹는 약)",
    product: "리벨서스",
    route: "ORAL",
    intervalDays: 1,
    doseSteps: [3, 7, 14],
  },
  {
    code: "TIRZEPATIDE_WEEKLY",
    ingredient: "터제파타이드",
    product: "마운자로",
    route: "INJECTION",
    intervalDays: 7,
    doseSteps: [2.5, 5, 7.5, 10, 12.5, 15],
  },
  {
    code: "LIRAGLUTIDE_DAILY_OB",
    ingredient: "리라글루타이드",
    product: "삭센다",
    route: "INJECTION",
    intervalDays: 1,
    doseSteps: [0.6, 1.2, 1.8, 2.4, 3],
  },
  {
    code: "LIRAGLUTIDE_DAILY_DM",
    ingredient: "리라글루타이드",
    product: "빅토자",
    route: "INJECTION",
    intervalDays: 1,
    doseSteps: [0.6, 1.2, 1.8],
  },
  {
    code: "DULAGLUTIDE_WEEKLY",
    ingredient: "둘라글루타이드",
    product: "트루리시티",
    route: "INJECTION",
    intervalDays: 7,
    doseSteps: [0.75, 1.5, 3, 4.5],
  },
  {
    code: "OTHER_WEEKLY",
    ingredient: "그 밖의 GLP-1 계열",
    product: "주 1회 주사",
    route: "INJECTION",
    intervalDays: 7,
    doseSteps: [],
  },
  {
    code: "OTHER_DAILY",
    ingredient: "그 밖의 GLP-1 계열",
    product: "매일 주사",
    route: "INJECTION",
    intervalDays: 1,
    doseSteps: [],
  },
] as const satisfies readonly DrugInfo[];

export type DrugCode = (typeof DRUGS)[number]["code"];
export const DRUG_CODES = DRUGS.map((d) => d.code) as [DrugCode, ...DrugCode[]];

const byCode = new Map<string, DrugInfo>(DRUGS.map((d) => [d.code, d]));

export function getDrug(code: string): DrugInfo | undefined {
  return byCode.get(code);
}

/** 직접 입력 용량의 허용 범위 (mg) */
export const DOSE_MIN_MG = 0.1;
export const DOSE_MAX_MG = 20;

export function isAllowedDose(drug: DrugInfo, doseMg: number): boolean {
  if (drug.doseSteps.length) return drug.doseSteps.includes(doseMg);
  return doseMg >= DOSE_MIN_MG && doseMg <= DOSE_MAX_MG;
}

/** 표준 단계 중 몇 번째 용량인지 (1부터). 목록에 없으면 null */
export function doseStepNumber(drug: DrugInfo, doseMg: number): number | null {
  const i = drug.doseSteps.indexOf(doseMg);
  return i >= 0 ? i + 1 : null;
}

export function formatDose(doseMg: number): string {
  return `${Number(doseMg.toFixed(2))}mg`;
}
