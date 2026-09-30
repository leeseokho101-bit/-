import { describe, expect, it } from "vitest";
import {
  bioAgeDisclaimer,
  medicationNote,
  projectionText,
} from "@/content/bio-age";
import {
  calculateBioAge,
  egfrFromCreatinine,
  metricGapYears,
} from "@/domain/bio-age/engine";
import {
  computeMedicationEffect,
  doseFactor,
  estimateUntreated,
  statinReduction,
} from "@/domain/bio-age/medication";
import { referenceMean, references } from "@/domain/bio-age/rules/reference";
import type { BioAgeInput } from "@/domain/bio-age/types";
import {
  DRUG_PRODUCTS,
  findProduct,
  INGREDIENTS,
  productOptionGroups,
  splitIntoIngredients,
} from "@/domain/medication/catalog";
import { checkText } from "@/domain/narrative/safety";
import { sampleUsers } from "@/dev/samples";
import { medicationsFormSchema } from "@/features/assessment/schemas";

const organ = (r: ReturnType<typeof calculateBioAge>, code: string) =>
  r.organs.find((o) => o.organ === code)!;

describe("medication catalog", () => {
  it("모든 제품의 성분이 정의되어 있고 코드가 겹치지 않는다", () => {
    expect(new Set(DRUG_PRODUCTS.map((p) => p.code)).size).toBe(
      DRUG_PRODUCTS.length,
    );
    for (const p of DRUG_PRODUCTS)
      for (const c of p.components) {
        expect(INGREDIENTS[c.ingredient], p.code).toBeDefined();
        expect(c.mg).toBeGreaterThan(0);
      }
  });

  it("선택 목록은 모든 제품을 한 번씩 포함한다", () => {
    const listed = productOptionGroups().flatMap((g) => g.products);
    expect(listed).toHaveLength(DRUG_PRODUCTS.length);
  });

  it("복합제는 단일 성분으로 나누고 하루 알 수를 곱한다", () => {
    expect(
      splitIntoIngredients([
        { drugCode: "AMLODIPINE_5+VALSARTAN_160", dailyTablets: 2 },
      ]),
    ).toEqual([
      { ingredient: "AMLODIPINE", dailyMg: 10 },
      { ingredient: "VALSARTAN", dailyMg: 320 },
    ]);
  });

  it("같은 성분이 여러 약에 있으면 합친다", () => {
    expect(
      splitIntoIngredients([
        { drugCode: "SITAGLIPTIN_50+METFORMIN_500", dailyTablets: 2 },
        { drugCode: "METFORMIN_500", dailyTablets: 1 },
        { drugCode: undefined },
      ]),
    ).toEqual([
      { ingredient: "METFORMIN", dailyMg: 1500 },
      { ingredient: "SITAGLIPTIN", dailyMg: 100 },
    ]);
  });
});

describe("medication effect", () => {
  it("용량이 늘면 효과가 커지고, 범위를 넘지 않는다", () => {
    expect(doseFactor(1, 0.22)).toBe(1);
    expect(doseFactor(0.5, 0.22)).toBeCloseTo(0.78);
    expect(doseFactor(2, 0.22)).toBeCloseTo(1.22);
    expect(doseFactor(100, 0.22)).toBeCloseTo(1.44);
    expect(doseFactor(0.001, 0.22)).toBe(0.4);
  });

  it("스타틴 LDL 감소율은 용량에 따라 단조 증가한다", () => {
    expect(statinReduction("ATORVASTATIN", 10)).toBeCloseTo(0.37);
    expect(statinReduction("ATORVASTATIN", 40)).toBeCloseTo(0.49);
    const doses = [2.5, 5, 10, 15, 20, 40, 80];
    const values = doses.map((d) => statinReduction("ROSUVASTATIN", d));
    for (let i = 1; i < values.length; i++)
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });

  it("서로 다른 계열 혈압약은 효과가 더해진다", () => {
    const one = computeMedicationEffect([{ drugCode: "AMLODIPINE_5" }]);
    const two = computeMedicationEffect([
      { drugCode: "AMLODIPINE_5+VALSARTAN_80" },
    ]);
    expect(one.sbp).toBeCloseTo(8.8);
    expect(two.sbp).toBeCloseTo(8.8 + 10.3);
    expect(two.quantified).toEqual(["BLOOD_PRESSURE"]);
  });

  it("지질약 병용은 곱으로 합쳐 LDL을 역산한다", () => {
    const eff = computeMedicationEffect([
      { drugCode: "ROSUVASTATIN_10+EZETIMIBE_10" },
    ]);
    expect(eff.ldlPct).toBeCloseTo(1 - (1 - 0.43) * (1 - 0.22), 2);
    const untreated = estimateUntreated(
      { LDL: 70, TOTAL_CHOLESTEROL: 150 },
      eff,
    );
    expect(untreated.LDL).toBeGreaterThan(150);
    expect(untreated.TOTAL_CHOLESTEROL! - 150).toBeCloseTo(
      untreated.LDL! - 70,
      0,
    );
  });
});

describe("metric → age gap", () => {
  it("같은 성별·나이 평균이면 0세", () => {
    for (const code of Object.keys(references) as (keyof typeof references)[])
      expect(
        metricGapYears(code, referenceMean(code, "MALE", 47), "MALE", 47),
      ).toBeCloseTo(0);
  });

  it("나쁜 방향은 +, 좋은 방향은 −이고 상한이 있다", () => {
    expect(metricGapYears("SBP", 150, "FEMALE", 45)).toBeGreaterThan(5);
    expect(metricGapYears("SBP", 300, "FEMALE", 45)).toBe(15);
    expect(metricGapYears("EGFR", 50, "MALE", 50)).toBeGreaterThan(5);
    expect(metricGapYears("HDL", 90, "MALE", 50)).toBe(-5);
    expect(metricGapYears("HEMOGLOBIN", 18, "MALE", 50)).toBe(-2);
  });

  it("크레아티닌으로 eGFR(CKD-EPI 2021)을 계산한다", () => {
    expect(egfrFromCreatinine(1.0, "MALE", 50)).toBeGreaterThanOrEqual(88);
    expect(egfrFromCreatinine(1.0, "MALE", 50)).toBeLessThanOrEqual(94);
    expect(egfrFromCreatinine(2.0, "FEMALE", 70)).toBeLessThan(30);
  });
});

describe("calculateBioAge", () => {
  const base: BioAgeInput = {
    sex: "MALE",
    age: 50,
    metrics: {
      FASTING_GLUCOSE: 110,
      HBA1C: 6.0,
      WAIST: 88,
      SBP: 124,
      DBP: 80,
      TRIGLYCERIDE: 140,
      HDL: 44,
    },
    medications: [],
  };

  it("당뇨약을 복용하면 약이 낮춰 준 만큼 당뇨나이를 보정한다", () => {
    const without = calculateBioAge(base);
    const withMed = calculateBioAge({
      ...base,
      medications: [{ drugCode: "METFORMIN_500", dailyTablets: 2 }],
    });
    const a = organ(without, "DIABETES");
    const b = organ(withMed, "DIABETES");
    expect(a.measuredGap).toBe(b.measuredGap);
    expect(a.adjustedGap).toBe(a.measuredGap);
    expect(b.adjustedGap!).toBeGreaterThan(b.measuredGap!);
    expect(b.medication).toBe("QUANTIFIED");
    // 약과 관련 없는 혈압나이는 그대로
    expect(organ(withMed, "BLOOD_PRESSURE").adjustedGap).toBe(
      organ(without, "BLOOD_PRESSURE").adjustedGap,
    );
  });

  it("용량이 많을수록 보정 폭이 크다", () => {
    const gap = (tablets: number) =>
      organ(
        calculateBioAge({
          ...base,
          medications: [{ drugCode: "METFORMIN_500", dailyTablets: tablets }],
        }),
        "DIABETES",
      ).adjustedGap!;
    expect(gap(4)).toBeGreaterThan(gap(1));
  });

  it("성분 정보 없이 목적만 있으면 보정하지 않고 안내한다", () => {
    const r = calculateBioAge({
      ...base,
      medications: [{ purpose: "혈당" }],
    });
    const d = organ(r, "DIABETES");
    expect(d.medication).toBe("UNQUANTIFIED");
    expect(d.adjustedGap).toBe(d.measuredGap);
    expect(r.medications.unquantified).toEqual(["GLUCOSE"]);
    // 대사증후군 요소는 약 복용으로 해당
    expect(
      r.metabolic.factors.find((f) => f.factor === "GLUCOSE")!.metByTherapy,
    ).toBe(true);
  });

  it("입력이 없는 영역은 판단을 보류한다", () => {
    const r = calculateBioAge(base);
    expect(organ(r, "LIVER").status).toBe("DATA_INSUFFICIENT");
    expect(organ(r, "ANEMIA").adjustedAge).toBeNull();
  });

  it("같은 입력이면 항상 같은 결과", () => {
    expect(calculateBioAge(base)).toEqual(calculateBioAge(base));
  });

  it("기준 요소가 2개 이하이면 도달 시점을 추정한다", () => {
    const r = calculateBioAge(base);
    expect(r.metabolic.metCount).toBe(1);
    const p = r.metabolic.projection;
    expect(p.status).toBe("PROJECTED");
    if (p.status === "PROJECTED") {
      expect(p.yearsUntil).toBeGreaterThan(0);
      expect(p.atAge).toBe(50 + p.yearsUntil);
      expect(p.factors).toHaveLength(3);
    }
  });

  it("대사증후군 나이가 많을수록 도달 시점이 빠르다", () => {
    const years = (waist: number, tg: number) => {
      const p = calculateBioAge({
        ...base,
        metrics: { ...base.metrics, WAIST: waist, TRIGLYCERIDE: tg },
      }).metabolic.projection;
      return p.status === "PROJECTED" ? p.yearsUntil : Infinity;
    };
    expect(years(89, 148)).toBeLessThan(years(80, 90));
  });
});

describe("samples", () => {
  const ageAt = (birth: string, ref: string) => {
    const b = new Date(birth);
    const r = new Date(ref);
    let a = r.getUTCFullYear() - b.getUTCFullYear();
    if (
      r.getUTCMonth() < b.getUTCMonth() ||
      (r.getUTCMonth() === b.getUTCMonth() && r.getUTCDate() < b.getUTCDate())
    )
      a--;
    return a;
  };
  const results = Object.fromEntries(
    sampleUsers.map((s) => [
      s.id,
      calculateBioAge({
        sex: s.sex,
        age: ageAt(s.birthDate, s.checkupDate),
        metrics: s.metrics,
        medications: s.medications,
      }),
    ]),
  );

  it("샘플 약 코드는 모두 카탈로그에 있다", () => {
    for (const s of sampleUsers)
      for (const m of s.medications)
        if (m.drugCode)
          expect(findProduct(m.drugCode), m.drugCode).toBeDefined();
  });

  it("A(양호)는 또래보다 젊고, E(복합)는 또래보다 많다", () => {
    expect(results.A.overall!.gap).toBeLessThan(0);
    expect(results.E.overall!.gap).toBeGreaterThan(5);
  });

  it("E는 약 복용 보정으로 혈압나이가 더 많아진다", () => {
    const bp = organ(results.E, "BLOOD_PRESSURE");
    expect(bp.adjustedGap!).toBeGreaterThan(bp.measuredGap!);
    expect(results.E.metabolic.projection.status).toBe("ALREADY_MET");
  });

  it("A는 30년 안에 판정 기준에 도달하지 않거나 먼 미래로 추정된다", () => {
    const p = results.A.metabolic.projection;
    expect(["NOT_WITHIN_HORIZON", "PROJECTED"]).toContain(p.status);
    if (p.status === "PROJECTED") expect(p.yearsUntil).toBeGreaterThan(10);
  });

  it("화면 문구는 금지 표현 검사를 통과한다", () => {
    const texts = [bioAgeDisclaimer];
    for (const r of Object.values(results)) {
      const p = projectionText(r);
      texts.push(p.title, p.body);
      for (const o of r.organs) {
        const note = medicationNote(o);
        if (note) texts.push(note);
      }
    }
    for (const t of texts) expect(checkText(t), t).toEqual({ ok: true });
  });
});

describe("medications form", () => {
  it("성분을 고르면 목적과 기본 알 수를 채운다", () => {
    const r = medicationsFormSchema.parse({
      meds: [{ name: "내 혈압약", drugCode: "AMLODIPINE_5+VALSARTAN_80" }],
    });
    expect(r.meds[0]).toMatchObject({ purpose: "혈압", dailyTablets: 1 });
  });

  it("목록에 없는 코드와 범위 밖 알 수는 거절한다", () => {
    expect(
      medicationsFormSchema.safeParse({
        meds: [{ name: "약", drugCode: "UNKNOWN_1" }],
      }).success,
    ).toBe(false);
    expect(
      medicationsFormSchema.safeParse({
        meds: [{ name: "약", drugCode: "METFORMIN_500", dailyTablets: "20" }],
      }).success,
    ).toBe(false);
  });
});
