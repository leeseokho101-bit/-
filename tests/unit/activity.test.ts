import { describe, expect, it } from "vitest";
import {
  aerobicFactor,
  estimateActivityChanges,
  glucoseResponse,
  projectBioAgeWithActivity,
  rampFraction,
  summarizeActivity,
  type DailyActivity,
  type ExerciseSession,
} from "@/domain/bio-age/activity";
import type { BioAgeInput } from "@/domain/bio-age/types";
import { addDays, koreaDate } from "@/features/activity/date";
import { activityFormSchema } from "@/features/activity/schemas";

const TODAY = "2026-10-19";

function days(
  n: number,
  steps: number | null,
  sessions: ExerciseSession[] = [],
  from = TODAY,
): DailyActivity[] {
  return Array.from({ length: n }, (_, i) => ({
    date: addDays(from, -i),
    steps,
    sessions,
  }));
}

// 가상 인물 (실제 개인정보 아님)
const input: BioAgeInput = {
  sex: "MALE",
  age: 55,
  medications: [],
  metrics: {
    SBP: 138,
    DBP: 88,
    FASTING_GLUCOSE: 112,
    HBA1C: 6.1,
    LDL: 145,
    HDL: 42,
    TRIGLYCERIDE: 190,
    TOTAL_CHOLESTEROL: 225,
    WAIST: 92,
    BMI: 26.5,
    ALT: 45,
    GGT: 60,
    AST: 32,
    EGFR: 85,
    HEMOGLOBIN: 14.5,
  },
};
const baseline = { dailySteps: 4500, aerobicMinPerWeek: 30 };

describe("summarizeActivity", () => {
  it("기록이 없으면 null", () => {
    expect(summarizeActivity([], TODAY, baseline)).toBeNull();
  });

  it("기록 시작 후 지난 날수로 평균 내고, 평소보다 늘어난 양만 센다", () => {
    const s = summarizeActivity(
      days(7, 8000, [{ type: "CYCLING", intensity: "MODERATE", minutes: 30 }]),
      TODAY,
      baseline,
    )!;
    expect(s.windowDays).toBe(7);
    expect(s.loggedDays).toBe(7);
    expect(s.avgSteps).toBe(8000);
    expect(s.weekly.aerobicMin).toBe(210);
    // 210 − 평소 30 = 180, 걸음수 (8000−4500)×7×0.75/100 = 183.75
    expect(s.increase.fromStepsMin).toBeCloseTo(183.8, 1);
    expect(s.increase.aerobicMin).toBeCloseTo(363.8, 1);
  });

  it("고강도는 2배, 가벼운 운동은 유산소 시간에 넣지 않는다 (걸음수로만 반영)", () => {
    const s = summarizeActivity(
      days(7, null, [
        { type: "RUNNING", intensity: "VIGOROUS", minutes: 10 },
        { type: "SWIMMING", intensity: "LIGHT", minutes: 60 },
        { type: "FLEXIBILITY", intensity: "MODERATE", minutes: 30 },
      ]),
      TODAY,
      {},
    )!;
    expect(s.weekly.aerobicMin).toBe(140);
  });

  it("기록하지 않은 날은 평소와 같다고 보고, 평소보다 적어도 음수로 만들지 않는다", () => {
    // 28일 중 하루만 기록, 그날 걸음수가 평소보다 적음
    const logs = [...days(1, 2000), ...days(1, null, [], addDays(TODAY, -27))];
    const s = summarizeActivity(logs, TODAY, baseline)!;
    expect(s.windowDays).toBe(28);
    expect(s.loggedDays).toBe(2);
    expect(s.increase.aerobicMin).toBe(0);
    expect(s.increase.fromStepsMin).toBe(0);
  });

  it("평균 기간은 최대 28일, 효과가 쌓이는 기간은 최대 12주", () => {
    const s = summarizeActivity(days(120, 9000), TODAY, baseline)!;
    expect(s.windowDays).toBe(28);
    expect(s.weeksSinceStart).toBe(12);
  });

  it("미래 날짜 기록은 무시한다", () => {
    expect(
      summarizeActivity(days(1, 9000, [], addDays(TODAY, 3)), TODAY, baseline),
    ).toBeNull();
  });
});

describe("용량·시간 계수", () => {
  it("유산소: 주 150분 = 1, 300분 = 1.5 상한", () => {
    expect(aerobicFactor(0)).toBe(0);
    expect(aerobicFactor(75)).toBe(0.5);
    expect(aerobicFactor(150)).toBe(1);
    expect(aerobicFactor(300)).toBe(1.5);
    expect(aerobicFactor(900)).toBe(1.5);
  });

  it("효과는 4주 63%, 12주 95%로 쌓인다", () => {
    expect(rampFraction(0)).toBe(0);
    expect(rampFraction(4)).toBeCloseTo(0.632, 3);
    expect(rampFraction(12)).toBeCloseTo(0.95, 2);
  });

  it("혈당 효과는 기저치가 높을수록 크다 (정상 10% ~ 당뇨 범위 100%)", () => {
    expect(glucoseResponse(5.0, undefined)).toBe(0.1);
    expect(glucoseResponse(6.45, undefined)).toBeCloseTo(0.5, 2);
    expect(glucoseResponse(8, undefined)).toBe(1);
    expect(glucoseResponse(undefined, undefined)).toBe(0);
  });
});

describe("estimateActivityChanges", () => {
  const full = (sessions: ExerciseSession[], b = {}) =>
    summarizeActivity(days(84, null, sessions), TODAY, b)!;
  const aerobic150: ExerciseSession[] = [
    { type: "CYCLING", intensity: "MODERATE", minutes: 150 / 7 },
  ];

  it("[CORN] 혈압 분류별 유산소 효과 (기준량·효과 100%)", () => {
    const s = full(aerobic150);
    const bp = (sbp: number, dbp: number) =>
      estimateActivityChanges({ SBP: sbp, DBP: dbp }, "MALE", s, 1);
    expect(bp(150, 95).map((c) => c.delta)).toEqual([-8, -5]);
    expect(bp(130, 84).map((c) => c.delta)).toEqual([-2, -2]);
    expect(bp(115, 75).map((c) => c.delta)).toEqual([-1, -1]);
  });

  it("[KOD] HDL은 주 120분 미만이면 바뀌지 않는다", () => {
    const low = full([{ type: "CYCLING", intensity: "MODERATE", minutes: 10 }]);
    expect(
      estimateActivityChanges({ HDL: 45 }, "MALE", low, 1).find(
        (c) => c.metric === "HDL",
      ),
    ).toBeUndefined();
    const ok = estimateActivityChanges(
      { HDL: 45 },
      "MALE",
      full(aerobic150),
      1,
    );
    expect(ok).toEqual([
      { metric: "HDL", from: 45, to: 48, delta: 3, source: "KOD" },
    ]);
  });

  it("[JAY] 허리둘레는 과체중 이상에서만, [MAFLD] ALT는 높은 경우에만", () => {
    const s = full(aerobic150);
    const lean = estimateActivityChanges(
      { WAIST: 78, BMI: 22, ALT: 20 },
      "FEMALE",
      s,
      1,
    );
    expect(lean).toEqual([]);
    const heavy = estimateActivityChanges(
      { WAIST: 95, BMI: 28, ALT: 50 },
      "MALE",
      s,
      1,
    );
    expect(heavy.find((c) => c.metric === "WAIST")?.delta).toBe(-2.8);
    expect(heavy.find((c) => c.metric === "ALT")?.delta).toBe(-2);
  });

  it("측정하지 않은 지표는 만들지 않고, 운동이 늘지 않았으면 변화가 없다", () => {
    expect(estimateActivityChanges({ LDL: 130 }, "MALE", full([]), 1)).toEqual(
      [],
    );
    const changes = estimateActivityChanges(
      { LDL: 130 },
      "MALE",
      full(aerobic150),
      1,
    );
    expect(changes.map((c) => c.metric)).toEqual(["LDL"]);
  });

  it("[CORN] 정적 근력운동은 혈압을 가장 크게 낮추지만 상한(10/6)을 넘지 않는다", () => {
    const s = full([
      { type: "ISOMETRIC", intensity: "MODERATE", minutes: 10 },
      { type: "STRENGTH", intensity: "MODERATE", minutes: 20 },
      { type: "RUNNING", intensity: "VIGOROUS", minutes: 40 },
    ]);
    const c = estimateActivityChanges({ SBP: 150, DBP: 95 }, "MALE", s, 1);
    expect(c.map((x) => x.delta)).toEqual([-10, -6]);
  });
});

describe("projectBioAgeWithActivity", () => {
  it("기록이 없으면 null", () => {
    expect(projectBioAgeWithActivity(input, [], TODAY, baseline)).toBeNull();
  });

  it("운동을 늘리면 예상 생체나이는 낮아지고, 오래 할수록 효과가 커진다", () => {
    const week = projectBioAgeWithActivity(
      input,
      days(7, 8000),
      TODAY,
      baseline,
    )!;
    const quarter = projectBioAgeWithActivity(
      input,
      days(84, 8000),
      TODAY,
      baseline,
    )!;
    expect(week.now.overall!.delta).toBeLessThan(0);
    expect(quarter.now.overall!.delta).toBeLessThan(week.now.overall!.delta);
    // 12주 지속 예상은 기록 기간과 무관하게 같은 운동량이면 같다
    expect(week.sustained.overall).toEqual(quarter.sustained.overall);
    for (const o of quarter.sustained.organs)
      expect(o.delta).toBeLessThanOrEqual(0);
  });

  it("변화 폭은 현실적인 범위다 (종합 생체나이 최대 몇 년 이내)", () => {
    const p = projectBioAgeWithActivity(
      input,
      days(84, 15000, [
        { type: "RUNNING", intensity: "VIGOROUS", minutes: 60 },
        { type: "STRENGTH", intensity: "VIGOROUS", minutes: 30 },
        { type: "ISOMETRIC", intensity: "MODERATE", minutes: 10 },
      ]),
      TODAY,
      baseline,
    )!;
    expect(p.sustained.overall!.delta).toBeGreaterThan(-4);
    expect(p.sustained.overall!.delta).toBeLessThan(0);
  });
});

describe("활동 기록 폼", () => {
  const schema = activityFormSchema(TODAY);

  it("오늘부터 지난 7일까지만, 미래는 안 된다", () => {
    expect(schema.safeParse({ date: TODAY }).success).toBe(true);
    expect(schema.safeParse({ date: addDays(TODAY, -6) }).success).toBe(true);
    expect(schema.safeParse({ date: addDays(TODAY, -7) }).success).toBe(false);
    expect(schema.safeParse({ date: addDays(TODAY, 1) }).success).toBe(false);
  });

  it("운동은 종류·강도·시간을 모두 입력해야 한다", () => {
    const ok = schema.safeParse({
      date: TODAY,
      steps: "7,500",
      sessions: [{ type: "CYCLING", intensity: "MODERATE", minutes: "30" }],
    });
    expect(ok.success && ok.data).toEqual({
      date: TODAY,
      steps: 7500,
      sessions: [{ type: "CYCLING", intensity: "MODERATE", minutes: 30 }],
    });
    const bad = schema.safeParse({
      date: TODAY,
      sessions: [{ type: "CYCLING" }],
    });
    expect(bad.success).toBe(false);
    expect(schema.safeParse({ date: TODAY, steps: "70000" }).success).toBe(
      false,
    );
  });

  it("하루 경계는 한국 시간 기준", () => {
    expect(koreaDate(new Date("2026-10-19T14:59:00Z"))).toBe("2026-10-19");
    expect(koreaDate(new Date("2026-10-19T15:00:00Z"))).toBe("2026-10-20");
  });
});
