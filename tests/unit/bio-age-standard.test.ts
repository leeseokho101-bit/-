import { describe, expect, it } from "vitest";
import {
  ageMidpoint,
  metricFromText,
  parseStandardTable,
  summarizeStandards,
} from "../../scripts/bio-age-reference/standard";
import { buildReferences } from "@/domain/bio-age/rules/reference";

/** 공단 "한국인 참조표준" 표와 같은 머리글 (수치는 모두 가상) */
const PCT = ["1", "5", "10", "25", "50", "75", "90", "95", "99"].map(
  (p) => `${p}분위수 (mg/dL)`,
);
const BASIC_HEADER = [
  "번호",
  "지역",
  "성별",
  "나이",
  "측정량",
  "측정값 (mg/dL)",
  "확장불확도 (mg/dL)",
  "포함인자",
  "신뢰의 수준",
  "측정 수 (명)",
  "분포 (95%) 하한 (mg/dL)",
  "분포 (95%) 상한 (mg/dL)",
  ...PCT,
];

function virtualBasicTable(title: string, region = "전국") {
  const rows: unknown[][] = [BASIC_HEADER];
  let no = 0;
  for (const sex of ["남성", "여성"])
    for (const [label, base] of [
      ["20~24 세", 90],
      ["25~26 세", 95],
      ["27~28 세", 100],
      ["29~30 세", 105],
      ["75 세 이상", 130],
    ] as const) {
      const shift = sex === "남성" ? 10 : 0;
      const m = base + shift;
      rows.push([
        ++no,
        region,
        sex,
        label,
        `${region} ${sex} ${label} 한국인의 ${title}`,
        m,
        5,
        2,
        "약 95%",
        1000,
        0,
        0,
        m - 40,
        m - 30,
        m - 20,
        m - 10,
        m,
        m + 10,
        m + 20,
        m + 30,
        m + 40,
      ]);
    }
  return rows;
}

describe("NHIS 한국인 참조표준 → 생체나이 기준", () => {
  it("측정량 문구로 지표를 찾고, 쓰지 않는 표는 건너뛴다", () => {
    expect(
      metricFromText(
        "전국 남성 20~24 세 한국인의 수축기 혈압 (고혈압약 복용자 제외)",
      ),
    ).toBe("SBP");
    expect(metricFromText("한국인의 HDL 콜레스테롤 농도")).toBe("HDL");
    expect(metricFromText("한국인의 혈당 농도")).toBe("FASTING_GLUCOSE");
    expect(metricFromText("한국인의 혈색소 농도")).toBe("HEMOGLOBIN");
    expect(metricFromText("한국인의 혈청크레아티닌 농도")).toBe("CREATININE");
    expect(metricFromText("한국인의 체질량지수")).toBeNull();
  });

  it("연령대 문구를 중앙 나이로 바꾼다", () => {
    expect(ageMidpoint("20~24 세")).toBe(22.5);
    expect(ageMidpoint("25~26 세")).toBe(26);
    expect(ageMidpoint("75 세 이상")).toBe(77.5);
    expect(ageMidpoint("모름")).toBeNull();
  });

  it("평균은 측정값, 퍼짐은 사분위범위/1.349로 계산한다", () => {
    const records = parseStandardTable(
      "한국인_총콜레스테롤_참조표준",
      virtualBasicTable("총콜레스테롤 농도"),
    );
    expect(records).toHaveLength(10);
    const ref = summarizeStandards(records, "가상");
    const male = ref.metrics.TOTAL_CHOLESTEROL!.MALE!;
    expect(male.ages).toEqual([22.5, 26, 28, 30, 77.5]);
    expect(male.mean[0]).toBe(100);
    expect(male.spread[0]).toBeCloseTo(20 / 1.349, 2);
    expect(male.n[0]).toBe(1000);
  });

  it("중성지방(로그 척도)은 중앙값과 기하표준편차를 쓴다", () => {
    const ref = summarizeStandards(
      parseStandardTable(
        "한국인_중성지방_참조표준",
        virtualBasicTable("중성지방 농도"),
      ),
      "가상",
    );
    const female = ref.metrics.TRIGLYCERIDE!.FEMALE!;
    expect(female.mean[0]).toBe(90);
    expect(female.spread[0]).toBeCloseTo(
      Math.exp(Math.log(100 / 80) / 1.349),
      3,
    );
  });

  it("전국 행이 없으면 시·도 행을 측정 수로 가중 평균한다", () => {
    const seoul = virtualBasicTable("허리둘레");
    const busan = virtualBasicTable("허리둘레", "부산").slice(1);
    // 부산은 모든 값 +10, 측정 수 3배
    for (const r of busan) {
      r[1] = "부산";
      r[9] = 3000;
      for (const i of [5, ...Array.from({ length: 9 }, (_, k) => 12 + k)])
        r[i] = (r[i] as number) + 10;
    }
    for (const r of seoul.slice(1)) r[1] = "서울";
    const ref = summarizeStandards(
      parseStandardTable("한국인_비만지수(허리둘레)_참조표준", [
        ...seoul,
        ...busan,
      ]),
      "가상",
    );
    const male = ref.metrics.WAIST!.MALE!;
    expect(male.mean[0]).toBeCloseTo(100 + 10 * 0.75, 1);
    expect(male.n[0]).toBe(4000);
  });

  it("포함/제외 구분이 있으면 '제외'(미치료 집단)를 쓴다", () => {
    const header = [
      "번호",
      "지역",
      "성별",
      "나이",
      "수축기/이완기",
      "고혈압약 복용자 포함 여부",
      "측정량",
      "측정값 (mmHg)",
      "확장불확도 (mmHg)",
      "포함인자",
      "신뢰의 수준",
      "표준편차 (mmHg)",
      "측정 수 (명)",
      ...PCT.map((p) => p.replace("mg/dL", "mmHg")),
    ];
    const rows: unknown[][] = [header];
    const ages = ["20~24 세", "25~26 세", "27~28 세", "29~30 세"];
    for (const variant of ["포함", "제외"])
      for (const age of ages) {
        const m = variant === "포함" ? 130 : 120;
        rows.push([
          0,
          "전국",
          "남성",
          age,
          "수축기",
          variant,
          `전국 남성 ${age} 한국인의 수축기 혈압 (고혈압약 복용자 ${variant})`,
          m,
          1,
          2,
          "약 95%",
          12,
          5000,
          m - 30,
          m - 20,
          m - 15,
          m - 8,
          m,
          m + 8,
          m + 15,
          m + 20,
          m + 30,
        ]);
      }
    const ref = summarizeStandards(
      parseStandardTable("한국인_혈압_참조표준", rows),
      "가상",
    );
    expect(ref.metrics.SBP!.MALE!.mean).toEqual([120, 120, 120, 120]);
    expect(ref.metrics.SBP!.MALE!.spread[0]).toBeCloseTo(16 / 1.349, 2);
  });

  it("크레아티닌 표로 eGFR 곡선을 만들고, 나이가 들수록 낮아진다", () => {
    const records = parseStandardTable("한국인_혈청크레아티닌_참조표준", [
      [
        "번호",
        "지역",
        "성별",
        "나이",
        "신장 관련 유병자 또는 약복용자 포함여부",
        "측정량",
        "측정값 (mg/dL)",
        "확장불확도 (mg/dL)",
        "포함인자",
        "신뢰의 수준",
        "표준편차 (mg/dL)",
        "측정 수 (명)",
        ...PCT,
      ],
      ...["20~24 세", "40~42 세", "60~62 세", "75 세 이상"].map((age, i) => [
        i,
        "전국",
        "남성",
        age,
        "제외",
        `한국인의 혈청크레아티닌 농도 (… 제외)`,
        0.95,
        0.05,
        2,
        "약 95%",
        0.15,
        5000,
        0.6,
        0.7,
        0.8,
        0.85,
        0.95,
        1.05,
        1.1,
        1.2,
        1.4,
      ]),
    ]);
    const ref = summarizeStandards(records, "가상");
    const egfr = ref.metrics.EGFR!.MALE!;
    expect(ref.metrics).not.toHaveProperty("CREATININE");
    expect(egfr.mean[0]).toBeGreaterThan(egfr.mean[3]);
    expect(egfr.spread[0]).toBeGreaterThan(5);
    // 생성 결과를 기준표에 적용하면 NHIS 곡선이 쓰인다 (4개 연령대 이상)
    expect(buildReferences(ref).EGFR.curves.MALE.source).toBe("NHIS");
    expect(buildReferences(ref).EGFR.curves.FEMALE.source).toBe("DRAFT");
  });

  it("참조표준 형식이 아니면 알려 준다", () => {
    expect(() =>
      parseStandardTable("다른 표", [
        ["이름", "값"],
        ["a", 1],
      ]),
    ).toThrow(/참조표준 표 형식/);
  });
});
