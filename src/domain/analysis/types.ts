/**
 * 건강분석 데이터 모델 (docs/ARCHITECTURE.md §5)
 * 상태는 의학적 진단이 아니라 "건강관리 관심 정도"를 뜻한다.
 */
import type { MetricCode } from "@/domain/health-snapshot/metrics";
import type { SurveyAnswers } from "@/domain/health-snapshot/survey";

export const DOMAIN_CODES = [
  "WEIGHT",
  "METABOLIC",
  "CARDIOVASCULAR",
  "GLYCEMIC",
  "LIVER",
  "KIDNEY",
  "EXERCISE",
  "SLEEP",
  "DIET",
  "LIFESTYLE",
] as const;
export type DomainCode = (typeof DOMAIN_CODES)[number];

export const DOMAIN_STATUSES = [
  "GOOD",
  "NORMAL",
  "ATTENTION",
  "MANAGEMENT_NEEDED",
  "DATA_INSUFFICIENT",
] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

/** 관리 필요도 1~5 (●●●○○ 표시). 데이터 부족이면 null */
export type ManagementLevel = 1 | 2 | 3 | 4 | 5;

// ─────────────── 입력 ───────────────

/** 복용 목적에서 추정한 "현재 관리 중인 항목" (약에 대한 판단은 하지 않는다) */
export type ManagedCondition = "BLOOD_PRESSURE" | "GLUCOSE" | "LIPID";

/** 분석 엔진의 유일한 입력 */
export type HealthSnapshot = {
  demographics: { sex: "MALE" | "FEMALE"; age: number };
  metrics: Partial<Record<MetricCode, number>>;
  survey: SurveyAnswers;
  managed: ManagedCondition[];
};

// ─────────────── 출력 ───────────────

/** 지표 한 개의 판정 구간 */
export type Band = "OPTIMAL" | "NORMAL" | "BORDERLINE" | "ELEVATED";

export type Finding = {
  /** 지표 코드 또는 문진 항목 (예: "BMI", "sleep.avgHours") */
  item: string;
  value: number | string | boolean;
  band: Band;
  /** 0~100 관리 필요 점수 */
  points: number;
  /** 설명 문구 키 (예: "weight.bmi.obese") — 템플릿/LLM 설명에 사용 */
  messageKey: string;
};

export type DomainResult = {
  domain: DomainCode;
  status: DomainStatus;
  level: ManagementLevel | null;
  /** 0~100 관리 필요 점수 (UI 비노출, 우선순위 계산용) */
  score: number;
  /** 0~1 영역에 필요한 입력의 충족률 */
  completeness: number;
  findings: Finding[];
  /** 복용 목적상 이미 관리 중인 항목이 이 영역과 관련 있는지 */
  managed: boolean;
};

export type PriorityMode = "IMPROVE" | "MAINTAIN";

export type PriorityItem = {
  rank: 1 | 2 | 3;
  domain: DomainCode;
  /** IMPROVE: 관리가 필요한 영역 / MAINTAIN: 현재 좋은 상태를 유지할 영역 */
  mode: PriorityMode;
  /** 내부 점수 (UI 비노출) */
  priorityScore: number;
  /** 근거가 된 finding의 messageKey (관리 필요도 높은 순) */
  reasons: string[];
  /** 이 영역을 관리하면 함께 좋아질 수 있는 영역 */
  relatedDomains: DomainCode[];
};

export type AnalysisOutput = {
  engineVersion: string;
  domains: DomainResult[];
  priorities: PriorityItem[];
  /** 입력이 부족해 판단하지 못한 영역 (입력 유도용) */
  dataGaps: DomainCode[];
};
