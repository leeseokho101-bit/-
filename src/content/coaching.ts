/** 코칭 센터·환자 코치 화면 문구 */
import type { ReferralReason } from "@/features/coaching/service";

export const specialtyLabels = {
  NUTRITION: "영양사",
  EXERCISE: "운동처방사",
} as const;

export const referralReasonLabels: Record<ReferralReason, string> = {
  MEDICATION_QUESTION: "약·용량 문의",
  PERSISTENT_SYMPTOM: "증상이 계속됨",
  LOW_GLUCOSE: "저혈당 의심 증상",
  OTHER: "기타",
};

export const scopeReasonText: Record<string, string> = {
  empty: "메시지를 적어 주세요.",
  "too-long": "1,000자 이내로 적어 주세요.",
  "dose-number":
    "용량 수치(mg)는 코칭 메시지에 쓸 수 없어요. 약·용량은 담당 의사에게 안내해 주세요.",
  "dose-change":
    "증량·감량에 관한 안내는 코칭 범위가 아니에요. 담당 의사에게 안내해 주세요.",
  "skip-dose":
    "투약을 쉬거나 미루는 안내는 코칭 범위가 아니에요. 담당 의원에 확인을 요청해 주세요.",
  "medication-directive":
    "약 복용·중단·변경 안내는 코칭 범위가 아니에요. 담당 의사에게 안내해 주세요.",
  "medication-start":
    "약 복용 안내는 코칭 범위가 아니에요. 담당 의사에게 안내해 주세요.",
  "disease-assertion":
    "질병명을 단정하는 표현은 쓸 수 없어요. 생활습관 중심으로 적어 주세요.",
  diagnosis: "진단 표현은 쓸 수 없어요.",
  probability: "질병 확률·위험도 수치는 쓸 수 없어요.",
  "no-doctor": "진료가 필요 없다는 표현은 쓸 수 없어요.",
  prognosis: "단정적인 예후 표현은 쓸 수 없어요.",
};

export const coachScopeNote =
  "코칭은 식사·운동·생활습관에 한정돼요. 약·용량·투약 일정, 진단에 관한 내용은 담당 의사에게 안내해 주세요. 위험 신호가 보이면 의원 확인 요청을 남겨 주세요.";

export const patientChatNote =
  "코치는 식사·운동·생활습관을 함께 챙겨요. 약·용량 질문은 담당 의사에게 여쭤봐 주세요. 급한 증상은 채팅으로 기다리지 말고 담당 의원에 연락하거나, 숨쉬기가 힘들면 119에 전화하세요.";
