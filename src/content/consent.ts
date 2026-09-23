/** 수집 동의 문구 (출시 전 법률 검토 필요 — docs/PRIVACY_AND_COMPLIANCE.md) */
export const CONSENT_VERSION = "consent-2026-09-v1";

export const consentItems = [
  {
    title: "수집 항목",
    body: "이름(별명), 이메일, 성별, 생년월일, 키·체중·허리둘레, 건강검진 수치, 생활습관 응답, 복용약 정보",
  },
  {
    title: "이용 목적",
    body: "건강관리 우선순위 분석과 12주 건강관리 계획 제공. 그 외 목적으로 사용하지 않습니다.",
  },
  {
    title: "보관 기간",
    body: "회원 탈퇴 또는 데이터 삭제 요청 시 지체 없이 파기합니다.",
  },
  {
    title: "외부 전송",
    body: "설명 문구 생성을 위해 이름·이메일·생년월일을 제외한 분석 요약 정보가 AI 서비스로 전송될 수 있습니다.",
  },
  {
    title: "동의 거부",
    body: "동의하지 않을 수 있으며, 이 경우 건강분석 서비스를 이용할 수 없습니다.",
  },
] as const;
