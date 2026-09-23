import {
  METRIC_GROUPS,
  METRICS,
  metricsByGroup,
} from "@/domain/health-snapshot/metrics";
import {
  frequencyLabels,
  smokingLabels,
} from "@/domain/health-snapshot/survey";
import type { AssessmentStepSlug } from "@/lib/routes";
import type { AssessmentInputs } from "./queries";

export type SummaryRow = { label: string; value: string | null };
export type SummarySection = {
  title: string;
  step: AssessmentStepSlug;
  rows: SummaryRow[];
};

const scaleLabels = {
  satisfaction: ["매우 불만족", "불만족", "보통", "만족", "매우 만족"],
  stress: ["거의 없음", "조금 있음", "보통", "많음", "매우 많음"],
};

const v = (value: unknown, unit = ""): string | null =>
  value === undefined || value === null ? null : `${value}${unit}`;

/** 입력 확인 화면용 요약 (값이 없으면 null → "미입력") */
export function buildReviewSummary(i: AssessmentInputs): SummarySection[] {
  const s = i.survey;
  const metric = (code: keyof typeof METRICS) =>
    v(i.metrics[code], ` ${METRICS[code].unit}`);

  return [
    {
      title: "기본정보",
      step: "profile",
      rows: [
        { label: "이름", value: i.displayName },
        {
          label: "성별",
          value: i.profile
            ? i.profile.sex === "MALE"
              ? "남성"
              : "여성"
            : null,
        },
        {
          label: "생년월일",
          value: i.profile?.birthDate.toISOString().slice(0, 10) ?? null,
        },
        { label: "키", value: metric("HEIGHT") },
        { label: "체중", value: metric("WEIGHT") },
        { label: "BMI", value: v(i.metrics.BMI) },
        { label: "허리둘레", value: metric("WAIST") },
      ],
    },
    {
      title: "건강검진",
      step: "checkup",
      rows: [
        {
          label: "검진일",
          value: i.checkupDate?.toISOString().slice(0, 10) ?? null,
        },
        ...METRIC_GROUPS.filter((g) => g.group !== "BODY").flatMap((g) =>
          metricsByGroup(g.group).map((m) => ({
            label: m.label,
            value: metric(m.code),
          })),
        ),
      ],
    },
    {
      title: "운동·수면",
      step: "survey",
      rows: [
        { label: "주당 운동 횟수", value: v(s.exercise.sessionsPerWeek, "회") },
        {
          label: "하루 걸음 수",
          value: v(s.exercise.dailySteps?.toLocaleString("ko-KR"), "보"),
        },
        {
          label: "주당 유산소 운동",
          value: v(s.exercise.aerobicMinPerWeek, "분"),
        },
        {
          label: "근력운동",
          value:
            s.exercise.strengthTraining === undefined
              ? null
              : s.exercise.strengthTraining
                ? "함"
                : "안 함",
        },
        { label: "평균 수면시간", value: v(s.sleep.avgHours, "시간") },
        {
          label: "취침 / 기상",
          value:
            s.sleep.bedtime || s.sleep.wakeTime
              ? `${s.sleep.bedtime ?? "-"} / ${s.sleep.wakeTime ?? "-"}`
              : null,
        },
        {
          label: "수면 만족도",
          value: s.sleep.satisfaction
            ? scaleLabels.satisfaction[s.sleep.satisfaction - 1]
            : null,
        },
      ],
    },
    {
      title: "생활습관",
      step: "lifestyle",
      rows: [
        {
          label: "아침식사",
          value: s.diet.breakfast ? frequencyLabels[s.diet.breakfast] : null,
        },
        {
          label: "야식",
          value: s.diet.lateNightSnack
            ? frequencyLabels[s.diet.lateNightSnack]
            : null,
        },
        {
          label: "외식·배달",
          value: s.diet.eatingOut ? frequencyLabels[s.diet.eatingOut] : null,
        },
        {
          label: "채소",
          value: s.diet.vegetables ? frequencyLabels[s.diet.vegetables] : null,
        },
        {
          label: "과일",
          value: s.diet.fruits ? frequencyLabels[s.diet.fruits] : null,
        },
        {
          label: "단 음료",
          value: s.diet.sugaryDrinks
            ? frequencyLabels[s.diet.sugaryDrinks]
            : null,
        },
        {
          label: "가공식품",
          value: s.diet.processedFood
            ? frequencyLabels[s.diet.processedFood]
            : null,
        },
        {
          label: "음주 빈도",
          value: s.alcohol.frequency
            ? frequencyLabels[s.alcohol.frequency]
            : null,
        },
        // 음주 "안 함"이면 음주량, 현재 흡연이 아니면 흡연량 문항은 해당 없음
        ...(s.alcohol.frequency === "NEVER"
          ? []
          : [
              {
                label: "1회 음주량",
                value: v(s.alcohol.drinksPerOccasion, "잔"),
              },
            ]),
        {
          label: "흡연",
          value: s.smoking.status ? smokingLabels[s.smoking.status] : null,
        },
        ...(s.smoking.status === "CURRENT"
          ? [
              {
                label: "하루 흡연량",
                value: v(s.smoking.cigarettesPerDay, "개비"),
              },
            ]
          : []),
        {
          label: "스트레스",
          value: s.stress.level ? scaleLabels.stress[s.stress.level - 1] : null,
        },
      ],
    },
    {
      title: "복용약",
      step: "medications",
      rows: s.medicationsNone
        ? [{ label: "복용약", value: "없음" }]
        : i.medications.length
          ? i.medications.map((m, idx) => ({
              label: `약 ${idx + 1}`,
              value: [m.name, m.purpose, m.frequency]
                .filter(Boolean)
                .join(" · "),
            }))
          : [{ label: "복용약", value: null }],
    },
  ];
}
