/**
 * 개발·데모용 가상 사용자 A~E
 * ⚠️ 모든 데이터는 가상입니다. 실제 인물·실제 검진 결과가 아닙니다.
 * 약 이름도 실제 제품명이 아닌 가상 이름을 사용합니다.
 * STEP 6 분석 엔진 테스트의 기준 데이터로도 사용합니다.
 */
import type { MetricCode } from "@/domain/health-snapshot/metrics";
import type { SurveyAnswers } from "@/domain/health-snapshot/survey";
import type { DomainCode } from "@/domain/analysis/types";

export type SampleUser = {
  id: "A" | "B" | "C" | "D" | "E";
  email: string;
  displayName: string;
  /** 샘플 설명 (개발용 화면 표시) */
  persona: string;
  sex: "MALE" | "FEMALE";
  birthDate: string;
  checkupDate: string;
  metrics: Partial<Record<Exclude<MetricCode, "BMI">, number>>;
  survey: SurveyAnswers;
  medications: { name: string; purpose?: string; frequency?: string }[];
  /** 분석 엔진이 우선순위 상위에 올려야 할 영역 (STEP 6 테스트 기준) */
  expectedFocus: DomainCode[];
};

/** 개발 환경 샘플 로그인용 공통 비밀번호 (production에서는 샘플 기능 자체가 비활성) */
export const SAMPLE_PASSWORD = "sample-password";

export const sampleUsers: SampleUser[] = [
  {
    id: "A",
    email: "sample-a@example.invalid",
    displayName: "가상 A",
    persona: "건강상태 양호 — 수치와 생활습관이 대체로 좋은 40대 남성",
    sex: "MALE",
    birthDate: "1980-04-12",
    checkupDate: "2026-06-10",
    metrics: {
      HEIGHT: 175,
      WEIGHT: 70,
      WAIST: 82,
      SBP: 116,
      DBP: 74,
      FASTING_GLUCOSE: 88,
      HBA1C: 5.2,
      TOTAL_CHOLESTEROL: 178,
      LDL: 98,
      HDL: 60,
      TRIGLYCERIDE: 88,
      AST: 22,
      ALT: 19,
      GGT: 24,
      CREATININE: 0.92,
      EGFR: 98,
    },
    survey: {
      exercise: {
        sessionsPerWeek: 4,
        dailySteps: 9000,
        aerobicMinPerWeek: 180,
        strengthTraining: true,
      },
      sleep: {
        avgHours: 7.5,
        bedtime: "23:00",
        wakeTime: "06:30",
        satisfaction: 4,
      },
      diet: {
        breakfast: "DAILY",
        lateNightSnack: "RARELY",
        eatingOut: "WEEKLY_1_2",
        vegetables: "DAILY",
        fruits: "WEEKLY_3_4",
        sugaryDrinks: "RARELY",
        processedFood: "RARELY",
      },
      alcohol: { frequency: "RARELY", drinksPerOccasion: 2 },
      smoking: { status: "NEVER" },
      stress: { level: 2 },
      medicationsNone: true,
    },
    medications: [],
    expectedFocus: [],
  },
  {
    id: "B",
    email: "sample-b@example.invalid",
    displayName: "가상 B",
    persona: "체중관리 중심 — BMI·허리둘레가 높고 활동량이 적은 50대 여성",
    sex: "FEMALE",
    birthDate: "1974-09-03",
    checkupDate: "2026-05-21",
    metrics: {
      HEIGHT: 160,
      WEIGHT: 78,
      WAIST: 93,
      SBP: 126,
      DBP: 80,
      FASTING_GLUCOSE: 97,
      HBA1C: 5.6,
      TOTAL_CHOLESTEROL: 204,
      LDL: 126,
      HDL: 51,
      TRIGLYCERIDE: 138,
      AST: 24,
      ALT: 29,
      GGT: 28,
      CREATININE: 0.72,
      EGFR: 94,
    },
    survey: {
      exercise: {
        sessionsPerWeek: 1,
        dailySteps: 3800,
        aerobicMinPerWeek: 30,
        strengthTraining: false,
      },
      sleep: {
        avgHours: 6.5,
        bedtime: "00:00",
        wakeTime: "06:30",
        satisfaction: 3,
      },
      diet: {
        breakfast: "WEEKLY_3_4",
        lateNightSnack: "WEEKLY_3_4",
        eatingOut: "WEEKLY_3_4",
        vegetables: "WEEKLY_1_2",
        fruits: "WEEKLY_1_2",
        sugaryDrinks: "DAILY",
        processedFood: "WEEKLY_3_4",
      },
      alcohol: { frequency: "RARELY", drinksPerOccasion: 2 },
      smoking: { status: "NEVER" },
      stress: { level: 3 },
      medicationsNone: true,
    },
    medications: [],
    expectedFocus: ["WEIGHT", "EXERCISE"],
  },
  {
    id: "C",
    email: "sample-c@example.invalid",
    displayName: "가상 C",
    persona: "혈당관리 중심 — 공복혈당·당화혈색소가 높은 편인 50대 후반 남성",
    sex: "MALE",
    birthDate: "1968-01-27",
    checkupDate: "2026-04-08",
    metrics: {
      HEIGHT: 170,
      WEIGHT: 73,
      WAIST: 88,
      SBP: 128,
      DBP: 82,
      FASTING_GLUCOSE: 119,
      HBA1C: 6.2,
      TOTAL_CHOLESTEROL: 192,
      LDL: 116,
      HDL: 45,
      TRIGLYCERIDE: 168,
      AST: 24,
      ALT: 27,
      GGT: 38,
      CREATININE: 1.0,
      EGFR: 84,
    },
    survey: {
      exercise: {
        sessionsPerWeek: 2,
        dailySteps: 5500,
        aerobicMinPerWeek: 60,
        strengthTraining: false,
      },
      sleep: {
        avgHours: 6.5,
        bedtime: "23:30",
        wakeTime: "06:00",
        satisfaction: 3,
      },
      diet: {
        breakfast: "RARELY",
        lateNightSnack: "WEEKLY_1_2",
        eatingOut: "WEEKLY_3_4",
        vegetables: "WEEKLY_3_4",
        fruits: "WEEKLY_1_2",
        sugaryDrinks: "WEEKLY_3_4",
        processedFood: "WEEKLY_1_2",
      },
      alcohol: { frequency: "WEEKLY_1_2", drinksPerOccasion: 4 },
      smoking: { status: "FORMER" },
      stress: { level: 3 },
      medicationsNone: false,
    },
    medications: [
      { name: "가상 오메가 영양제", purpose: "영양제", frequency: "하루 1회" },
    ],
    expectedFocus: ["GLYCEMIC"],
  },
  {
    id: "D",
    email: "sample-d@example.invalid",
    displayName: "가상 D",
    persona:
      "생활습관 중심 — 수치는 대체로 괜찮지만 수면·운동·식습관·흡연 관리가 필요한 40대 여성 (일부 검진 항목 미입력)",
    sex: "FEMALE",
    birthDate: "1982-11-19",
    checkupDate: "2026-07-02",
    metrics: {
      HEIGHT: 163,
      WEIGHT: 57,
      WAIST: 74,
      SBP: 114,
      DBP: 72,
      FASTING_GLUCOSE: 90,
      TOTAL_CHOLESTEROL: 186,
      LDL: 108,
      HDL: 62,
      TRIGLYCERIDE: 96,
      AST: 20,
      ALT: 16,
      GGT: 22,
      // HbA1c, 크레아티닌, eGFR 미입력 → 데이터 부족 처리 확인용
    },
    survey: {
      exercise: {
        sessionsPerWeek: 0,
        dailySteps: 3000,
        aerobicMinPerWeek: 0,
        strengthTraining: false,
      },
      sleep: {
        avgHours: 5,
        bedtime: "01:30",
        wakeTime: "06:30",
        satisfaction: 1,
      },
      diet: {
        breakfast: "NEVER",
        lateNightSnack: "DAILY",
        eatingOut: "DAILY",
        vegetables: "RARELY",
        fruits: "RARELY",
        sugaryDrinks: "DAILY",
        processedFood: "WEEKLY_3_4",
      },
      alcohol: { frequency: "WEEKLY_3_4", drinksPerOccasion: 5 },
      smoking: { status: "CURRENT", cigarettesPerDay: 10 },
      stress: { level: 5 },
      medicationsNone: true,
    },
    medications: [],
    expectedFocus: ["SLEEP", "EXERCISE", "LIFESTYLE", "DIET"],
  },
  {
    id: "E",
    email: "sample-e@example.invalid",
    displayName: "가상 E",
    persona:
      "복합적인 건강관리 필요 — 체중·혈압·혈당·지질·간 수치가 함께 높은 60대 남성",
    sex: "MALE",
    birthDate: "1963-06-05",
    checkupDate: "2026-03-17",
    metrics: {
      HEIGHT: 168,
      WEIGHT: 86,
      WAIST: 102,
      SBP: 148,
      DBP: 94,
      FASTING_GLUCOSE: 132,
      HBA1C: 6.8,
      TOTAL_CHOLESTEROL: 238,
      LDL: 162,
      HDL: 36,
      TRIGLYCERIDE: 256,
      AST: 46,
      ALT: 58,
      GGT: 96,
      CREATININE: 1.28,
      EGFR: 58,
    },
    survey: {
      exercise: {
        sessionsPerWeek: 0,
        dailySteps: 2500,
        aerobicMinPerWeek: 0,
        strengthTraining: false,
      },
      sleep: {
        avgHours: 5.5,
        bedtime: "00:30",
        wakeTime: "06:00",
        satisfaction: 2,
      },
      diet: {
        breakfast: "WEEKLY_1_2",
        lateNightSnack: "WEEKLY_3_4",
        eatingOut: "DAILY",
        vegetables: "WEEKLY_1_2",
        fruits: "RARELY",
        sugaryDrinks: "WEEKLY_3_4",
        processedFood: "WEEKLY_3_4",
      },
      alcohol: { frequency: "WEEKLY_3_4", drinksPerOccasion: 7 },
      smoking: { status: "CURRENT", cigarettesPerDay: 20 },
      stress: { level: 4 },
      medicationsNone: false,
    },
    medications: [
      { name: "가상 혈압약", purpose: "혈압", frequency: "하루 1회 아침" },
      {
        name: "가상 콜레스테롤약",
        purpose: "콜레스테롤",
        frequency: "하루 1회 저녁",
      },
    ],
    expectedFocus: [
      "METABOLIC",
      "CARDIOVASCULAR",
      "GLYCEMIC",
      "WEIGHT",
      "LIVER",
    ],
  },
];
