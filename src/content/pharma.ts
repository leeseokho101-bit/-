/** 제약사 포털 문구 */
export const pharmaPrivacyNote =
  '"제약사 통계 제공"에 동의한 환자의 기록만 집계해요. 개별 의원의 처방량·환자 수와 개별 환자 정보는 보여주지 않아요. 5명 미만인 숫자는 "5 미만"으로 가리고, 분석 대상이 10명 미만이면 결과를 내지 않아요. 참여 의원이 3곳 미만인 지역은 "그 밖의 지역"으로 합쳐요.';

export const persistenceNote =
  "중단 = 환자가 앱에 기록한 치료 중단, 또는 투약 기록이 주 1회 약 3주·매일 쓰는 약 1주 넘게 없는 경우(사유 미입력). 아직 치료 중인 환자는 지금까지의 기간만 반영해요(Kaplan–Meier). 앱 기록에 기반한 추정이며 실제 처방·복용과 다를 수 있어요.";

export const reasonLabels = {
  SIDE_EFFECTS: "부작용",
  COST: "비용 부담",
  INCONVENIENCE: "투약·관리 번거로움",
  GOAL_REACHED: "목표 도달",
  DOCTOR_ADVICE: "의사 판단",
  OTHER: "기타",
  UNRECORDED: "사유 미입력 (기록 중단)",
} as const;
