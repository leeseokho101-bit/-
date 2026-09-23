/** 생활습관 기반 영역: 운동 · 수면 · 식습관 · 생활습관(음주·흡연·스트레스) */
import type { Frequency } from "@/domain/health-snapshot/survey";
import { thresholds as T } from "../rules/thresholds";
import type { Band, DomainResult, Finding, HealthSnapshot } from "../types";
import { buildDomainResult, finding, isPresent } from "./common";

export function evaluateExercise(s: HealthSnapshot): DomainResult {
  const e = s.survey.exercise;
  const X = T.exercise;
  const f: Finding[] = [];

  if (isPresent(e.aerobicMinPerWeek)) {
    const v = e.aerobicMinPerWeek;
    if (v >= X.aerobicMinPerWeek.optimal)
      f.push(
        finding(
          "exercise.aerobicMinPerWeek",
          v,
          "OPTIMAL",
          "exercise.aerobic.enough",
        ),
      );
    else if (v >= X.aerobicMinPerWeek.normal)
      f.push(
        finding(
          "exercise.aerobicMinPerWeek",
          v,
          "NORMAL",
          "exercise.aerobic.some",
        ),
      );
    else if (v > 0)
      f.push(
        finding(
          "exercise.aerobicMinPerWeek",
          v,
          "BORDERLINE",
          "exercise.aerobic.low",
        ),
      );
    else
      f.push(
        finding(
          "exercise.aerobicMinPerWeek",
          v,
          "ELEVATED",
          "exercise.aerobic.none",
          75,
        ),
      );
  }
  if (isPresent(e.dailySteps)) {
    const v = e.dailySteps;
    if (v >= X.dailySteps.optimal)
      f.push(
        finding("exercise.dailySteps", v, "OPTIMAL", "exercise.steps.enough"),
      );
    else if (v >= X.dailySteps.normal)
      f.push(
        finding("exercise.dailySteps", v, "NORMAL", "exercise.steps.some"),
      );
    else if (v >= X.dailySteps.borderline)
      f.push(
        finding("exercise.dailySteps", v, "BORDERLINE", "exercise.steps.low"),
      );
    else
      f.push(
        finding(
          "exercise.dailySteps",
          v,
          "ELEVATED",
          "exercise.steps.veryLow",
          75,
        ),
      );
  }
  if (isPresent(e.sessionsPerWeek)) {
    const v = e.sessionsPerWeek;
    if (v >= X.sessionsPerWeek.optimal)
      f.push(
        finding(
          "exercise.sessionsPerWeek",
          v,
          "OPTIMAL",
          "exercise.sessions.regular",
        ),
      );
    else if (v >= X.sessionsPerWeek.normal)
      f.push(
        finding(
          "exercise.sessionsPerWeek",
          v,
          "NORMAL",
          "exercise.sessions.some",
        ),
      );
    else
      f.push(
        finding(
          "exercise.sessionsPerWeek",
          v,
          "BORDERLINE",
          "exercise.sessions.none",
        ),
      );
  }
  if (isPresent(e.strengthTraining)) {
    f.push(
      e.strengthTraining
        ? finding(
            "exercise.strengthTraining",
            true,
            "OPTIMAL",
            "exercise.strength.yes",
          )
        : finding(
            "exercise.strengthTraining",
            false,
            "BORDERLINE",
            "exercise.strength.no",
            45,
          ),
    );
  }

  return buildDomainResult({
    domain: "EXERCISE",
    findings: f,
    requiredInputs: 4,
    providedInputs: f.length,
    rule: "habit",
  });
}

/** "HH:MM" → 자정 기준 분 (저녁 18시 이후는 음수: 23:00 → -60) */
function bedtimeMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const minutes = h * 60 + m;
  return h >= 18 ? minutes - 24 * 60 : minutes;
}

export function evaluateSleep(s: HealthSnapshot): DomainResult {
  const sl = s.survey.sleep;
  const H = T.sleep.hours;
  const f: Finding[] = [];

  if (isPresent(sl.avgHours)) {
    const v = sl.avgHours;
    if (v >= H.optimalMin && v <= H.optimalMax)
      f.push(finding("sleep.avgHours", v, "OPTIMAL", "sleep.hours.good"));
    else if (v >= H.normalMin && v <= H.normalMax)
      f.push(
        finding(
          "sleep.avgHours",
          v,
          "NORMAL",
          v < H.optimalMin
            ? "sleep.hours.slightlyShort"
            : "sleep.hours.slightlyLong",
        ),
      );
    else if (v >= H.lowMin)
      f.push(
        finding(
          "sleep.avgHours",
          v,
          "BORDERLINE",
          v < H.normalMin ? "sleep.hours.short" : "sleep.hours.long",
        ),
      );
    else
      f.push(
        finding("sleep.avgHours", v, "ELEVATED", "sleep.hours.veryShort", 80),
      );
  }
  if (isPresent(sl.satisfaction)) {
    const v = sl.satisfaction;
    const band: Band =
      v >= 4
        ? "OPTIMAL"
        : v === 3
          ? "NORMAL"
          : v === 2
            ? "BORDERLINE"
            : "ELEVATED";
    f.push(
      finding(
        "sleep.satisfaction",
        v,
        band,
        `sleep.satisfaction.${band.toLowerCase()}`,
        band === "ELEVATED" ? 70 : undefined,
      ),
    );
  }
  if (isPresent(sl.bedtime)) {
    const m = bedtimeMinutes(sl.bedtime);
    if (m > T.sleep.bedtimeLateMin)
      f.push(
        finding(
          "sleep.bedtime",
          sl.bedtime,
          "BORDERLINE",
          "sleep.bedtime.late",
          50,
        ),
      );
    else if (m > T.sleep.bedtimeNormalMin)
      f.push(
        finding(
          "sleep.bedtime",
          sl.bedtime,
          "NORMAL",
          "sleep.bedtime.slightlyLate",
        ),
      );
    else
      f.push(
        finding("sleep.bedtime", sl.bedtime, "OPTIMAL", "sleep.bedtime.good"),
      );
  }

  return buildDomainResult({
    domain: "SLEEP",
    findings: f,
    requiredInputs: 3,
    providedInputs: f.length,
    rule: "habit",
  });
}

/** 빈도 → 구간. 좋은 습관(아침·채소·과일)은 자주 할수록, 나쁜 습관은 적을수록 좋다 */
const FREQ_BANDS: Record<string, Record<Frequency, Band>> = {
  breakfast: {
    DAILY: "OPTIMAL",
    WEEKLY_3_4: "NORMAL",
    WEEKLY_1_2: "BORDERLINE",
    RARELY: "BORDERLINE",
    NEVER: "BORDERLINE",
  },
  vegetables: {
    DAILY: "OPTIMAL",
    WEEKLY_3_4: "NORMAL",
    WEEKLY_1_2: "BORDERLINE",
    RARELY: "ELEVATED",
    NEVER: "ELEVATED",
  },
  fruits: {
    DAILY: "OPTIMAL",
    WEEKLY_3_4: "OPTIMAL",
    WEEKLY_1_2: "NORMAL",
    RARELY: "BORDERLINE",
    NEVER: "BORDERLINE",
  },
  lateNightSnack: {
    NEVER: "OPTIMAL",
    RARELY: "OPTIMAL",
    WEEKLY_1_2: "NORMAL",
    WEEKLY_3_4: "BORDERLINE",
    DAILY: "ELEVATED",
  },
  eatingOut: {
    NEVER: "OPTIMAL",
    RARELY: "OPTIMAL",
    WEEKLY_1_2: "OPTIMAL",
    WEEKLY_3_4: "NORMAL",
    DAILY: "BORDERLINE",
  },
  sugaryDrinks: {
    NEVER: "OPTIMAL",
    RARELY: "OPTIMAL",
    WEEKLY_1_2: "NORMAL",
    WEEKLY_3_4: "BORDERLINE",
    DAILY: "ELEVATED",
  },
  processedFood: {
    NEVER: "OPTIMAL",
    RARELY: "OPTIMAL",
    WEEKLY_1_2: "NORMAL",
    WEEKLY_3_4: "BORDERLINE",
    DAILY: "ELEVATED",
  },
};

/** 식습관 항목은 하나만으로 영역 전체를 좌우하지 않도록 점수를 낮게 둔다 */
const DIET_POINTS: Record<Band, number> = {
  OPTIMAL: 0,
  NORMAL: 20,
  BORDERLINE: 45,
  ELEVATED: 65,
};

export function evaluateDiet(s: HealthSnapshot): DomainResult {
  const d = s.survey.diet;
  const f: Finding[] = [];
  for (const [key, bands] of Object.entries(FREQ_BANDS)) {
    const v = d[key as keyof typeof d];
    if (!isPresent(v)) continue;
    const band = bands[v];
    f.push(
      finding(
        `diet.${key}`,
        v,
        band,
        `diet.${key}.${band.toLowerCase()}`,
        DIET_POINTS[band],
      ),
    );
  }
  // 식습관은 문항이 많아 ELEVATED 1개만으로 관리 필요로 보지 않는다
  const result = buildDomainResult({
    domain: "DIET",
    findings: f,
    requiredInputs: 7,
    providedInputs: f.length,
    rule: "habit",
  });
  const elevated = f.filter((x) => x.band === "ELEVATED").length;
  const borderline = f.filter((x) => x.band === "BORDERLINE").length;
  if (result.status === "MANAGEMENT_NEEDED" && elevated + borderline < 3) {
    return { ...result, status: "ATTENTION", level: 3 };
  }
  return result;
}

export function evaluateLifestyle(s: HealthSnapshot): DomainResult {
  const { alcohol, smoking, stress } = s.survey;
  const sex = s.demographics.sex;
  const f: Finding[] = [];

  if (isPresent(smoking.status)) {
    if (smoking.status === "CURRENT")
      f.push(
        finding(
          "smoking.status",
          "CURRENT",
          "ELEVATED",
          "lifestyle.smoking.current",
          90,
        ),
      );
    else if (smoking.status === "FORMER")
      f.push(
        finding(
          "smoking.status",
          "FORMER",
          "NORMAL",
          "lifestyle.smoking.former",
        ),
      );
    else
      f.push(
        finding(
          "smoking.status",
          "NEVER",
          "OPTIMAL",
          "lifestyle.smoking.never",
        ),
      );
  }
  if (isPresent(alcohol.frequency)) {
    const freq = alcohol.frequency;
    const drinks = alcohol.drinksPerOccasion ?? 0;
    const frequent = freq === "WEEKLY_3_4" || freq === "DAILY";
    const twicePlusWeekly = frequent || freq === "WEEKLY_1_2";
    if (freq === "NEVER" || freq === "RARELY")
      f.push(finding("alcohol", freq, "OPTIMAL", "lifestyle.alcohol.low"));
    else if (twicePlusWeekly && drinks >= T.alcohol.highRiskDrinks[sex])
      f.push(
        finding(
          "alcohol",
          `${freq}:${drinks}`,
          "ELEVATED",
          "lifestyle.alcohol.highRisk",
        ),
      );
    else if (frequent)
      f.push(
        finding(
          "alcohol",
          `${freq}:${drinks}`,
          "BORDERLINE",
          "lifestyle.alcohol.frequent",
        ),
      );
    else
      f.push(
        finding(
          "alcohol",
          `${freq}:${drinks}`,
          "NORMAL",
          "lifestyle.alcohol.moderate",
        ),
      );
  }
  if (isPresent(stress.level)) {
    const v = stress.level;
    const band: Band =
      v <= 2
        ? "OPTIMAL"
        : v === 3
          ? "NORMAL"
          : v === 4
            ? "BORDERLINE"
            : "ELEVATED";
    f.push(
      finding(
        "stress.level",
        v,
        band,
        `lifestyle.stress.${band.toLowerCase()}`,
        band === "ELEVATED" ? 70 : undefined,
      ),
    );
  }

  return buildDomainResult({
    domain: "LIFESTYLE",
    findings: f,
    requiredInputs: 3,
    providedInputs: f.length,
    rule: "habit",
  });
}
