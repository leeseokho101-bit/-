import { describe, expect, it } from "vitest";
import { analyze } from "@/domain/analysis/engine";
import { calculatePriorities } from "@/domain/analysis/priority";
import {
  ageOn,
  buildHealthSnapshot,
  inferManagedConditions,
} from "@/domain/analysis/snapshot";
import type { DomainResult } from "@/domain/analysis/types";
import { surveyAnswersSchema } from "@/domain/health-snapshot/survey";
import { domain, snap } from "./engine-helpers";

const status = (
  s: ReturnType<typeof snap>,
  code: Parameters<typeof domain>[1],
) => domain(s, code).status;

describe("체중건강 (BMI · 허리둘레)", () => {
  it.each([
    [22.9, 70, "GOOD"],
    [23, 70, "ATTENTION"],
    [24.9, 70, "ATTENTION"],
    [25, 70, "MANAGEMENT_NEEDED"],
    [18.4, 70, "ATTENTION"],
  ])("BMI %s → %s", (bmi, waist, expected) => {
    expect(
      status(snap({ metrics: { BMI: bmi, WAIST: waist } }), "WEIGHT"),
    ).toBe(expected);
  });

  it("BMI 30 이상은 관리 필요도 5단계", () => {
    expect(
      domain(snap({ metrics: { BMI: 31, WAIST: 100 } }), "WEIGHT").level,
    ).toBe(5);
  });

  it("허리둘레 기준은 성별에 따라 다르다 (남 90 / 여 85)", () => {
    expect(
      status(
        snap({ sex: "FEMALE", metrics: { BMI: 21, WAIST: 86 } }),
        "WEIGHT",
      ),
    ).toBe("MANAGEMENT_NEEDED");
    expect(
      status(snap({ sex: "MALE", metrics: { BMI: 21, WAIST: 86 } }), "WEIGHT"),
    ).toBe("ATTENTION");
  });
});

describe("심혈관건강 (혈압)", () => {
  it.each([
    [118, 76, "GOOD"],
    [125, 78, "NORMAL"],
    [130, 78, "ATTENTION"],
    [125, 80, "ATTENTION"],
    [140, 85, "MANAGEMENT_NEEDED"],
    [135, 90, "MANAGEMENT_NEEDED"],
  ])("%s/%s → %s", (sbp, dbp, expected) => {
    expect(
      status(
        snap({
          metrics: {
            SBP: sbp,
            DBP: dbp,
            LDL: 90,
            TOTAL_CHOLESTEROL: 170,
            HDL: 65,
          },
        }),
        "CARDIOVASCULAR",
      ),
    ).toBe(expected);
  });
});

describe("혈당건강", () => {
  it.each([
    [99, 5.6, "GOOD"],
    [100, 5.6, "ATTENTION"],
    [99, 5.7, "ATTENTION"],
    [126, 5.6, "MANAGEMENT_NEEDED"],
    [99, 6.5, "MANAGEMENT_NEEDED"],
  ])("공복혈당 %s, HbA1c %s → %s", (fbg, a1c, expected) => {
    expect(
      status(
        snap({ metrics: { FASTING_GLUCOSE: fbg, HBA1C: a1c } }),
        "GLYCEMIC",
      ),
    ).toBe(expected);
  });

  it("두 지표 중 하나만 있어도 판단한다 (충족률 50%)", () => {
    const d = domain(snap({ metrics: { FASTING_GLUCOSE: 90 } }), "GLYCEMIC");
    expect(d.status).toBe("GOOD");
    expect(d.completeness).toBe(0.5);
  });
});

describe("대사건강 (5개 요소 개수)", () => {
  const base = {
    WAIST: 80,
    SBP: 118,
    DBP: 75,
    FASTING_GLUCOSE: 90,
    TRIGLYCERIDE: 100,
    HDL: 55,
  };
  it.each([
    [{}, "GOOD"],
    [{ TRIGLYCERIDE: 150 }, "NORMAL"],
    [{ TRIGLYCERIDE: 150, HDL: 39 }, "ATTENTION"],
    [{ TRIGLYCERIDE: 150, HDL: 39, FASTING_GLUCOSE: 100 }, "MANAGEMENT_NEEDED"],
  ])("%o → %s", (override, expected) => {
    expect(
      status(snap({ metrics: { ...base, ...override } }), "METABOLIC"),
    ).toBe(expected);
  });

  it("복용 목적이 혈압이면 혈압 요소를 해당으로 본다", () => {
    const d = domain(
      snap({
        metrics: { ...base, TRIGLYCERIDE: 150 },
        managed: ["BLOOD_PRESSURE"],
      }),
      "METABOLIC",
    );
    expect(d.status).toBe("ATTENTION");
    expect(d.managed).toBe(true);
  });

  it("입력이 3개 미만이면 데이터 부족", () => {
    expect(status(snap({ metrics: { WAIST: 80, HDL: 55 } }), "METABOLIC")).toBe(
      "DATA_INSUFFICIENT",
    );
  });
});

describe("간 · 신장", () => {
  it("γ-GTP 기준은 성별에 따라 다르다", () => {
    const m = { AST: 20, ALT: 20, GGT: 40 };
    expect(status(snap({ sex: "FEMALE", metrics: m }), "LIVER")).toBe(
      "ATTENTION",
    );
    expect(status(snap({ sex: "MALE", metrics: m }), "LIVER")).toBe("GOOD");
  });

  it("eGFR 60 미만은 관리 필요", () => {
    expect(
      status(snap({ metrics: { EGFR: 59, CREATININE: 1.2 } }), "KIDNEY"),
    ).toBe("MANAGEMENT_NEEDED");
    expect(
      status(snap({ metrics: { EGFR: 75, CREATININE: 1.0 } }), "KIDNEY"),
    ).toBe("NORMAL");
  });
});

describe("생활습관 영역", () => {
  it("운동: 권장량을 채우면 양호, 활동이 거의 없으면 관리 필요", () => {
    expect(
      status(
        snap({
          survey: {
            exercise: {
              aerobicMinPerWeek: 150,
              dailySteps: 8000,
              sessionsPerWeek: 3,
              strengthTraining: true,
            },
          },
        }),
        "EXERCISE",
      ),
    ).toBe("GOOD");
    expect(
      status(
        snap({
          survey: { exercise: { aerobicMinPerWeek: 0, dailySteps: 2000 } },
        }),
        "EXERCISE",
      ),
    ).toBe("MANAGEMENT_NEEDED");
  });

  it("수면: 자정을 넘긴 취침 시각을 올바르게 계산한다", () => {
    const d = domain(
      snap({
        survey: { sleep: { avgHours: 7.5, satisfaction: 4, bedtime: "23:30" } },
      }),
      "SLEEP",
    );
    expect(d.status).toBe("GOOD");
    const late = domain(
      snap({
        survey: { sleep: { avgHours: 7.5, satisfaction: 4, bedtime: "02:00" } },
      }),
      "SLEEP",
    );
    expect(late.status).toBe("ATTENTION");
  });

  it("식습관: 나쁜 습관 1개만으로는 관리 필요가 되지 않는다", () => {
    const d = domain(
      snap({
        survey: {
          diet: {
            breakfast: "DAILY",
            vegetables: "DAILY",
            fruits: "DAILY",
            sugaryDrinks: "DAILY",
            lateNightSnack: "RARELY",
            eatingOut: "WEEKLY_1_2",
            processedFood: "RARELY",
          },
        },
      }),
      "DIET",
    );
    expect(d.status).toBe("ATTENTION");
  });

  it("고위험음주 기준은 성별에 따라 다르다 (남 7잔 / 여 5잔, 주 2회 이상)", () => {
    const survey = {
      alcohol: { frequency: "WEEKLY_3_4" as const, drinksPerOccasion: 5 },
    };
    expect(
      domain(snap({ sex: "FEMALE", survey }), "LIFESTYLE").findings[0]
        .messageKey,
    ).toBe("lifestyle.alcohol.highRisk");
    expect(
      domain(snap({ sex: "MALE", survey }), "LIFESTYLE").findings[0].messageKey,
    ).toBe("lifestyle.alcohol.frequent");
  });

  it("현재 흡연은 생활습관 관리 필요", () => {
    expect(
      status(
        snap({
          survey: { smoking: { status: "CURRENT", cigarettesPerDay: 5 } },
        }),
        "LIFESTYLE",
      ),
    ).toBe("MANAGEMENT_NEEDED");
  });
});

describe("데이터 부족", () => {
  it("아무것도 입력하지 않으면 모든 영역이 데이터 부족이고 TOP 3는 비어 있다", () => {
    const out = analyze(snap({}));
    expect(out.domains.every((d) => d.status === "DATA_INSUFFICIENT")).toBe(
      true,
    );
    expect(out.dataGaps).toHaveLength(10);
    expect(out.priorities).toEqual([]);
  });

  it("입력이 부족해도 뚜렷한 이상 소견이 있으면 알려준다", () => {
    const d = domain(snap({ metrics: { AST: 80 } }), "LIVER");
    expect(d.completeness).toBeLessThan(0.5);
    expect(d.status).toBe("MANAGEMENT_NEEDED");
  });
});

describe("우선순위 계산", () => {
  const make = (
    domain: DomainResult["domain"],
    score: number,
    completeness = 1,
  ): DomainResult => ({
    domain,
    status: "MANAGEMENT_NEEDED",
    level: 4,
    score,
    completeness,
    findings: [],
    managed: false,
  });

  it("점수가 같으면 고정된 영역 순서로 정렬한다", () => {
    const p = calculatePriorities([make("LIVER", 80), make("KIDNEY", 80)]);
    expect(p.map((x) => x.domain).slice(0, 2)).toEqual(["LIVER", "KIDNEY"]);
  });

  it("입력 충족률이 낮으면 우선순위가 낮아진다", () => {
    const p = calculatePriorities([
      make("LIVER", 80, 0.34),
      make("KIDNEY", 80, 1),
    ]);
    expect(p[0].domain).toBe("KIDNEY");
  });

  it("관리 필요 영역이 3개 미만이면 유지 항목으로 채운다", () => {
    const good = (d: DomainResult["domain"]): DomainResult => ({
      ...make(d, 0),
      status: "GOOD",
      level: 1,
    });
    const p = calculatePriorities([
      make("WEIGHT", 80),
      good("EXERCISE"),
      good("SLEEP"),
      good("LIVER"),
    ]);
    expect(p.map((x) => [x.domain, x.mode])).toEqual([
      ["WEIGHT", "IMPROVE"],
      ["EXERCISE", "MAINTAIN"],
      ["SLEEP", "MAINTAIN"],
    ]);
  });
});

describe("스냅샷 생성", () => {
  it("복용 목적 키워드로 관리 중 항목을 추정한다 (약 이름은 보지 않는다)", () => {
    expect(
      inferManagedConditions(["고혈압", "당뇨 관리", null, "콜레스테롤"]),
    ).toEqual(["BLOOD_PRESSURE", "GLUCOSE", "LIPID"]);
    expect(inferManagedConditions(["영양제"])).toEqual([]);
  });

  it("만 나이를 계산한다", () => {
    expect(ageOn(new Date("1970-05-10"), new Date("2026-05-09"))).toBe(55);
    expect(ageOn(new Date("1970-05-10"), new Date("2026-05-10"))).toBe(56);
  });

  it("BMI는 키·체중으로 다시 계산한다", () => {
    const s = buildHealthSnapshot({
      sex: "MALE",
      birthDate: new Date("1970-01-01"),
      referenceDate: new Date("2026-01-01"),
      metrics: { HEIGHT: 170, WEIGHT: 72, BMI: 99 },
      survey: surveyAnswersSchema.parse({}),
      medicationPurposes: [],
    });
    expect(s.metrics.BMI).toBe(24.9);
  });
});
