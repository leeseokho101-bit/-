/**
 * GLP-1 케어(환자 앱) 문구. 생활 속 대처만 안내하고, 약 복용·용량·일정은 항상 담당 의사와 상의하도록 한다.
 * 출시 전 의학 감수 필요 (docs/PRIVACY_AND_COMPLIANCE.md §GLP-1 케어).
 */
import type { AlertKind } from "@/domain/glp1/alerts";
import type { RangeBand, MealRiseBand } from "@/domain/glp1/cgm";
import type { InjectionSite } from "@/domain/glp1/dosing";
import type { MealType } from "@/domain/glp1/meal";
import type {
  RedFlagCode,
  Severity,
  SymptomCode,
  TriageLevel,
} from "@/domain/glp1/symptoms";

export const CARE_CONSENT_VERSION = "care-consent-2026-10-v2";

export const careConsentItems = [
  {
    name: "consentService",
    required: true,
    title: "[필수] 서비스 이용을 위한 건강정보 수집·이용",
    body: "투약 기록, 혈당(CGM) 값, 식사 기록, 부작용 체크인, 체중, 코치와 나눈 대화를 모아 관리 화면과 위험 신호 안내를 제공합니다. 담당 코치(영양사·운동처방사)가 이 기록을 보고 생활습관 코칭을 합니다. 탈퇴하거나 삭제를 요청하면 지체 없이 파기합니다.",
  },
  {
    name: "shareWithClinic",
    required: false,
    title: "[선택] 담당 의원과 공유",
    body: "연결한 의원의 의료진이 진료에 참고할 수 있도록 기록 요약과 위험 신호를 공유합니다. 동의하지 않아도 앱은 그대로 쓸 수 있어요.",
  },
  {
    name: "allowResearch",
    required: false,
    title: "[선택] 연구 활용 (가명처리)",
    body: "이름·연락처 등 식별정보를 뺀 가명정보를 약물 반응·생활습관 연구에 활용합니다.",
  },
  {
    name: "allowPharmaStats",
    required: false,
    title: "[선택] 제약사 통계 제공 (집계)",
    body: "개인을 알아볼 수 없는 집계 통계(지역별 이용자 수, 지속 복용률 등)만 제공합니다. 개인 기록은 제공하지 않습니다.",
  },
] as const;

export const careDisclaimer =
  "이 화면은 기록과 생활 관리를 돕는 참고 정보이며 의학적 진단이 아닙니다. 약의 용량·투약 일정은 담당 의사가 정하며, 바꾸고 싶거나 궁금한 점은 담당 의사와 상의하세요.";

export const siteLabels: Record<InjectionSite, string> = {
  ABDOMEN_LEFT: "배 왼쪽",
  ABDOMEN_RIGHT: "배 오른쪽",
  THIGH_LEFT: "왼쪽 허벅지",
  THIGH_RIGHT: "오른쪽 허벅지",
  ARM_LEFT: "왼쪽 위팔",
  ARM_RIGHT: "오른쪽 위팔",
};

export const siteTip =
  "같은 자리에 계속 주사하면 피부가 딱딱해질 수 있어요. 지난번과 다른 부위를 쓰고, 같은 부위 안에서도 조금씩 자리를 옮겨 주세요.";

export const mealTypeLabels: Record<MealType, string> = {
  BREAKFAST: "아침",
  LUNCH: "점심",
  DINNER: "저녁",
  SNACK: "간식",
};

export const symptomLabels: Record<SymptomCode, string> = {
  NAUSEA: "메스꺼움",
  VOMITING: "구토",
  DIARRHEA: "설사",
  CONSTIPATION: "변비",
  ABDOMINAL_PAIN: "복통",
  FATIGUE: "피로감",
};

export const severityLabels: Record<Severity, string> = {
  0: "없음",
  1: "약간",
  2: "보통",
  3: "심함",
};

export const redFlagLabels: Record<RedFlagCode, string> = {
  SEVERE_ABDOMINAL_PAIN: "참기 힘든 배 통증이 계속되거나 등까지 퍼져요",
  CANNOT_KEEP_FLUIDS: "물을 마셔도 계속 토해서 거의 마시지 못해요",
  SWELLING_BREATHING: "얼굴·입술·목이 붓거나 숨쉬기가 힘들어요",
  LOW_GLUCOSE_SYMPTOMS:
    "식은땀·손떨림·심한 어지럼처럼 혈당이 떨어진 느낌이 있었어요",
  DEHYDRATION_SIGNS: "소변이 눈에 띄게 줄었거나, 일어설 때 심하게 어지러워요",
};

/** 증상별 생활 속 대처 (약에 대한 지시 없음) */
export const copingTips: Record<SymptomCode, readonly string[]> = {
  NAUSEA: [
    "한 번에 조금씩, 천천히 드시고 배부르기 전에 멈춰 주세요.",
    "기름지거나 맵고 단 음식은 잠시 줄이고, 담백한 음식을 골라 주세요.",
    "식사 뒤 바로 눕지 말고, 물은 식사 중보다 식사 사이에 조금씩 드세요.",
  ],
  VOMITING: [
    "토한 뒤에는 물이나 이온음료를 한두 모금씩 자주 드세요.",
    "속이 가라앉을 때까지 기름진 음식은 피하고, 죽처럼 부드러운 음식부터 드세요.",
    "물도 마시기 어렵거나 하루 넘게 이어지면 담당 의원에 연락해 주세요.",
  ],
  DIARRHEA: [
    "빠져나간 수분을 채우도록 물을 자주 드세요.",
    "기름진 음식, 유제품, 찬 음식은 잠시 줄여 주세요.",
  ],
  CONSTIPATION: [
    "물을 충분히 드시고, 채소·과일·잡곡처럼 식이섬유가 많은 음식을 챙겨 주세요.",
    "식사 뒤 가볍게 걸으면 장 움직임에 도움이 돼요.",
  ],
  ABDOMINAL_PAIN: [
    "과식을 피하고, 천천히 드세요.",
    "통증이 심해지거나 계속되면 참지 말고 진료를 받으세요.",
  ],
  FATIGUE: [
    "식사량이 줄어도 단백질(달걀·두부·생선·살코기)은 끼니마다 챙겨 주세요.",
    "물을 자주 드시고, 잠을 충분히 주무세요.",
  ],
};

export const escalationTip =
  "증상이 오래가거나 걱정되면 담당 의원에 연락해 상의하세요. 약을 계속 쓸지, 용량을 어떻게 할지는 담당 의사가 판단합니다.";

export const triageContent: Record<
  TriageLevel,
  { title: string; body: string; tone: "ok" | "info" | "warn" | "danger" }
> = {
  NONE: {
    title: "오늘은 불편한 증상이 없어요",
    body: "지금처럼 천천히, 조금씩 드시고 물을 충분히 챙겨 주세요.",
    tone: "ok",
  },
  SELF_CARE: {
    title: "생활 속 대처로 관리해 보세요",
    body: "처음 쓰기 시작했거나 용량이 바뀐 뒤 몇 주는 속이 불편할 수 있어요. 아래 방법을 해 보시고 내일도 기록해 주세요.",
    tone: "info",
  },
  CONTACT_CLINIC: {
    title: "오늘 담당 의원에 연락해 상의해 주세요",
    body: "기록한 증상은 의료진 상담이 필요한 신호일 수 있어요. 오늘 안에 담당 의원에 연락해 주세요.",
    tone: "warn",
  },
  URGENT: {
    title: "바로 진료를 받으세요",
    body: "기록한 증상은 바로 진료가 필요한 신호일 수 있어요. 지금 담당 의원이나 가까운 응급실에 연락하고, 숨쉬기가 힘들거나 의식이 흐려지면 119에 전화하세요.",
    tone: "danger",
  },
};

export const alertContent: Record<AlertKind, string> = {
  SEVERE_SYMPTOM: "체크인에서 의료진 상담이 필요한 증상을 기록했어요.",
  PERSISTENT_VOMITING: "구토가 3일 이상 이어지고 있어요.",
  LOW_GLUCOSE:
    "최근 7일 동안 혈당이 70mg/dL 아래로 내려간 구간이 여러 번 있었어요.",
  SEVERE_LOW_GLUCOSE:
    "최근 7일 동안 혈당이 54mg/dL 아래로 15분 넘게 내려간 구간이 있었어요.",
  MISSED_DOSES: "최근 4주 동안 투약을 여러 번 놓쳤어요.",
  COACH_REFERRAL: "담당 코치가 의원과 상의해 보시는 게 좋겠다고 알려 왔어요.",
};

export const alertAction = "에 연락해 상의해 주세요.";
export const missedDoseAction =
  "놓친 투약을 언제 할지는 담당 의원에 물어보세요.";

export const rangeLabels: Record<RangeBand, string> = {
  VERY_LOW: "매우 낮음 (54 미만)",
  LOW: "낮음 (54~69)",
  IN_RANGE: "목표 범위 (70~180)",
  HIGH: "높음 (181~250)",
  VERY_HIGH: "매우 높음 (250 초과)",
};

export const mealRiseLabels: Record<MealRiseBand, string> = {
  SMALL: "작게 올랐어요",
  MODERATE: "보통으로 올랐어요",
  LARGE: "많이 올랐어요",
};

export const escalationSupport =
  "용량이 바뀐 뒤 2주 정도는 메스꺼움 같은 불편이 생기기 쉬운 시기예요. 조금씩 천천히 드시고, 매일 체크인으로 몸 상태를 기록해 주세요.";

export const glucoseNote =
  "목표 범위(70~180mg/dL)와 목표 비율은 당뇨 관리에 쓰는 국제 합의 기준을 참고로 보여드려요. 나에게 맞는 목표는 담당 의사와 상의하세요.";

export const stopReasonLabels = {
  SIDE_EFFECTS: "부작용이 힘들어서",
  COST: "비용 부담",
  INCONVENIENCE: "투약·관리가 번거로워서",
  GOAL_REACHED: "목표 체중·혈당에 도달",
  DOCTOR_ADVICE: "담당 의사의 판단",
  OTHER: "기타",
} as const;

export const stopNote =
  "담당 의사와 상의해 치료를 그만두셨다면 기록해 주세요. 투약 알림과 누락 알림이 멈춰요. 다시 시작하면 언제든 되돌릴 수 있어요. 그만둘지 고민 중이라면 먼저 담당 의사와 상의하세요.";
