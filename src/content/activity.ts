/**
 * 활동 기록·운동 반영 생체나이 화면 문구
 * - 진단·질병 확률 표현 금지. 예상치는 "평균적인 효과로 계산한 참고값"으로만 설명한다.
 */
import type { ExerciseType, Intensity } from "@/domain/bio-age/activity";

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  RUNNING: "달리기·조깅",
  CYCLING: "자전거",
  SWIMMING: "수영",
  HIKING: "등산",
  BALL_SPORTS: "구기·라켓 운동 (배드민턴·테니스·탁구 등)",
  DANCE: "에어로빅·댄스",
  CARDIO_MACHINE: "실내 유산소 기구 (러닝머신·실내자전거 등)",
  OTHER_AEROBIC: "기타 유산소 운동",
  STRENGTH: "근력운동 (기구·맨몸·밴드)",
  ISOMETRIC: "정적 근력운동 (플랭크·벽 스쿼트 등)",
  FLEXIBILITY: "요가·스트레칭·필라테스",
};

/** 말하기 테스트(talk test)로 강도를 고른다 */
export const intensityLabels: Record<
  Intensity,
  { label: string; help: string }
> = {
  LIGHT: { label: "가볍게", help: "노래를 부를 수 있을 정도" },
  MODERATE: { label: "중간", help: "말은 되지만 노래는 어려움" },
  VIGOROUS: { label: "힘들게", help: "몇 마디 넘게 말하기 어려움" },
};

/** activity-effects.ts의 근거 키 → 화면 표시용 짧은 출처 */
export const activitySourceLabels: Record<string, string> = {
  CORN: "Cornelissen & Smart, J Am Heart Assoc 2013",
  UMP: "Umpierre 외, JAMA 2011",
  "UMP·ADAG": "Umpierre 외, JAMA 2011 · Nathan 외, Diabetes Care 2008",
  KOD: "Kodama 외, Arch Intern Med 2007",
  KELM: "Kelley & Kelley, 남성 대상 메타분석 2006",
  KELW: "Kelley 외, 여성 대상 메타분석 2004",
  JAY: "Jayedi 외, JAMA Netw Open 2024",
  MAFLD: "대사이상 지방간 운동 RCT 메타분석",
};

/** 걸음수·운동량 목표 (관찰연구 근거) */
export const activityTargets = {
  steps: (age: number) =>
    age >= 60
      ? "하루 6,000~8,000보 (60세 이상은 이 구간까지 사망위험이 계속 낮아졌어요)"
      : "하루 8,000~10,000보 (60세 미만은 이 구간까지 사망위험이 계속 낮아졌어요)",
  stepsSource: "Paluch 외, Lancet Public Health 2022 (15개 코호트, 47,471명)",
  aerobic: "중간 강도 운동 주 150~300분 (힘든 운동은 1분을 2분으로 계산)",
  aerobicSource: "WHO 신체활동 지침 2020 · Arem 외, JAMA Intern Med 2015",
  strength: "근력운동 주 2회 (주 30~60분에서 사망위험이 가장 많이 낮았어요)",
  strengthSource: "Momma 외, Br J Sports Med 2022",
};

export const activityDisclaimer =
  "운동 반영 생체나이는 임상시험에서 확인된 평균적인 수치 변화를 현재 검진 수치에 더해 계산한 예상값이에요. 사람마다 효과는 다르고, 실제 변화는 다음 건강검진에서 확인할 수 있어요. 새로 운동을 시작하거나 강도를 높일 때 몸에 무리가 느껴지면 의료진과 상담하세요.";
