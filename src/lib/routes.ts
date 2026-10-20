/**
 * 앱 경로 정의 (docs/ARCHITECTURE.md §2 Sitemap)
 * 건강정보는 경로나 query string에 절대 포함하지 않습니다.
 */
export const routes = {
  home: "/",
  about: "/about",
  login: "/login",
  signup: "/signup",
  assessment: "/assessment",
  checkupPhoto: "/assessment/checkup/photo",
  report: "/report",
  reportProfile: "/report/profile",
  reportPriorities: "/report/priorities",
  reportPlan: "/report/plan",
  reportBioAge: "/report/bio-age",
  dashboard: "/dashboard",
  activity: "/activity",
  care: "/care",
  careStart: "/care/start",
  careDose: "/care/dose",
  careGlucose: "/care/glucose",
  careMeals: "/care/meals",
  careCheckIn: "/care/check-in",
  careResponse: "/care/response",
  careSettings: "/care/settings",
  clinic: "/clinic",
  mypage: "/mypage",
  devSamples: "/dev/samples",
} as const;

/** 건강분석 입력 단계 (순서 = 화면 진행 순서) */
export const assessmentSteps = [
  {
    slug: "profile",
    title: "기본정보",
    description: "나이·성별·체형 정보를 알려주세요.",
  },
  {
    slug: "checkup",
    title: "건강검진",
    description: "건강검진 결과표의 수치를 입력해 주세요.",
  },
  {
    slug: "survey",
    title: "운동·수면",
    description: "평소 운동과 수면 습관을 알려주세요.",
  },
  {
    slug: "lifestyle",
    title: "생활습관",
    description: "식습관, 음주, 흡연, 스트레스를 알려주세요.",
  },
  {
    slug: "medications",
    title: "복용약",
    description: "현재 복용 중인 약이 있다면 적어주세요.",
  },
  {
    slug: "review",
    title: "입력 확인",
    description: "입력한 내용을 확인하고 분석을 시작합니다.",
  },
] as const;

export type AssessmentStepSlug = (typeof assessmentSteps)[number]["slug"];

export function assessmentStepPath(slug: AssessmentStepSlug): string {
  return `${routes.assessment}/${slug}`;
}

export function getAssessmentStep(slug: AssessmentStepSlug) {
  const index = assessmentSteps.findIndex((s) => s.slug === slug);
  const step = assessmentSteps[index];
  const prev = index > 0 ? assessmentSteps[index - 1] : undefined;
  const next =
    index < assessmentSteps.length - 1 ? assessmentSteps[index + 1] : undefined;
  return {
    step,
    index,
    number: index + 1,
    total: assessmentSteps.length,
    prevPath: prev ? assessmentStepPath(prev.slug) : routes.assessment,
    nextPath: next
      ? assessmentStepPath(next.slug)
      : `${routes.assessment}/analyzing`,
  };
}

/** 분석 결과 하위 탭 */
export const reportTabs = [
  { href: routes.report, label: "요약" },
  { href: routes.reportProfile, label: "건강 프로파일" },
  { href: routes.reportBioAge, label: "생체나이" },
  { href: routes.reportPriorities, label: "우선순위 TOP 3" },
  { href: routes.reportPlan, label: "12주 계획" },
] as const;

/** GLP-1 케어(환자 앱) 하단 메뉴 */
export const careTabs = [
  { href: routes.care, label: "홈", icon: "⌂" },
  { href: routes.careDose, label: "투약", icon: "💉" },
  { href: routes.careGlucose, label: "혈당", icon: "📈" },
  { href: routes.careMeals, label: "식사", icon: "🍚" },
  { href: routes.careCheckIn, label: "체크인", icon: "✓" },
] as const;

/** 의사 대시보드 환자 리포트 경로. 환자 ID(추측 불가능한 cuid)만 담고, 접근 시 의원·공유 동의를 확인한다 */
export function clinicPatientPath(patientId: string): string {
  return `${routes.clinic}/patients/${patientId}`;
}
