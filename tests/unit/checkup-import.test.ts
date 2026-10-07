import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { fromFhirObservations } from "@/domain/checkup-import/fhir";
import {
  fromNhisRecord,
  metricForLabel,
  NHIS_FIELD_ALIASES,
} from "@/domain/checkup-import/nhis";
import {
  normalizeCheckup,
  parseLooseDate,
  validCheckupDate,
} from "@/domain/checkup-import/normalize";
import {
  photoReadJsonSchema,
  photoReadSchema,
  sniffImageType,
} from "@/domain/checkup-import/photo";
import { IMPORTABLE_CODES } from "@/domain/checkup-import/types";
import { toCanonicalUnit } from "@/domain/checkup-import/units";
import { importWarningText } from "@/content/checkup-import";
import {
  confirmImportFormSchema,
  importedValuesOf,
} from "@/features/checkup-import/schemas";
import { AnthropicCheckupPhotoReader } from "@/server/ai/checkup-reader";
import { LlmProviderError } from "@/server/ai/provider";
import {
  createCheckupCenterConnector,
  createNhisConnector,
  listCheckupConnectors,
} from "@/server/integrations/checkup/connectors";
import { ConnectorNotConfiguredError } from "@/server/integrations/checkup/types";

const TODAY = new Date("2026-09-30T00:00:00Z");

describe("단위 변환", () => {
  it("기준 단위·빈 단위는 그대로, 한글 조합 문자도 인식한다", () => {
    expect(toCanonicalUnit("FASTING_GLUCOSE", 98, "mg/dL")).toEqual({
      ok: true,
      value: 98,
      converted: false,
    });
    expect(toCanonicalUnit("FASTING_GLUCOSE", 98, "㎎/㎗")).toMatchObject({
      ok: true,
      converted: false,
    });
    expect(toCanonicalUnit("SBP", 120, "")).toMatchObject({ ok: true });
    expect(toCanonicalUnit("EGFR", 90, "mL/min/1.73㎡")).toMatchObject({
      ok: true,
      converted: false,
    });
  });

  it("mmol/L·µmol/L·m 등은 기준 단위로 바꾼다", () => {
    const g = toCanonicalUnit("FASTING_GLUCOSE", 5.5, "mmol/L");
    expect(g.ok && Math.round(g.value)).toBe(99);
    const c = toCanonicalUnit("CREATININE", 88.42, "µmol/L");
    expect(c.ok && c.value).toBeCloseTo(1, 5);
    const h = toCanonicalUnit("HEIGHT", 1.7, "m");
    expect(h.ok && h.value).toBeCloseTo(170, 5);
  });

  it("알 수 없는 단위는 거절한다", () => {
    expect(toCanonicalUnit("WEIGHT", 150, "lb")).toEqual({ ok: false });
  });
});

describe("normalizeCheckup", () => {
  it("단위 변환·반올림 후 허용 범위 안의 값만 남긴다", () => {
    const out = normalizeCheckup(
      {
        checkupDate: "2026-03-15",
        items: [
          { metric: "FASTING_GLUCOSE", value: 5.5, unit: "mmol/L" },
          { metric: "CREATININE", value: 0.876, unit: "mg/dL" },
          { metric: "LDL", value: 9999, unit: "mg/dL" },
          { metric: "WEIGHT", value: 150, unit: "lb" },
          { metric: "HDL", value: 50, unit: "mg/dL" },
          { metric: "HDL", value: 55, unit: "mg/dL" },
        ],
      },
      TODAY,
    );
    expect(out.checkupDate).toBe("2026-03-15");
    expect(out.values).toEqual({
      FASTING_GLUCOSE: 99,
      CREATININE: 0.88,
      HDL: 50,
    });
    expect(out.warnings).toEqual(
      expect.arrayContaining([
        { kind: "unit-converted", metric: "FASTING_GLUCOSE" },
        { kind: "out-of-range", metric: "LDL" },
        { kind: "unknown-unit", metric: "WEIGHT" },
        { kind: "duplicate", metric: "HDL" },
      ]),
    );
  });

  it("수축기 ≤ 이완기면 혈압 두 값을 모두 버린다", () => {
    const out = normalizeCheckup(
      {
        items: [
          { metric: "SBP", value: 80 },
          { metric: "DBP", value: 120 },
        ],
      },
      TODAY,
    );
    expect(out.values).toEqual({});
    expect(out.warnings).toContainEqual({ kind: "bp-order", metric: "SBP" });
  });

  it("잘못된·미래 검진일은 버린다", () => {
    expect(validCheckupDate("2026-02-30", TODAY)).toBeUndefined();
    expect(validCheckupDate("2027-01-01", TODAY)).toBeUndefined();
    expect(validCheckupDate("1980-01-01", TODAY)).toBeUndefined();
    expect(validCheckupDate("2026-09-30", TODAY)).toBe("2026-09-30");
    const out = normalizeCheckup(
      { checkupDate: "2099-01-01", items: [] },
      TODAY,
    );
    expect(out.checkupDate).toBeUndefined();
    expect(out.warnings).toEqual([{ kind: "invalid-date" }]);
  });

  it("BMI 등 가져오지 않는 항목·숫자가 아닌 값은 무시한다", () => {
    const out = normalizeCheckup(
      {
        items: [
          { metric: "BMI" as never, value: 24 },
          { metric: "AST", value: Number.NaN },
        ],
      },
      TODAY,
    );
    expect(out.values).toEqual({});
  });

  it("모든 경고에 사용자 안내 문구가 있다", () => {
    for (const kind of [
      "unknown-unit",
      "unit-converted",
      "out-of-range",
      "duplicate",
      "bp-order",
      "invalid-date",
    ] as const) {
      expect(importWarningText({ kind, metric: "LDL" }).length).toBeGreaterThan(
        5,
      );
    }
  });
});

describe("parseLooseDate", () => {
  it.each([
    ["20240315", "2024-03-15"],
    ["2024.03.15", "2024-03-15"],
    ["2024-3-5", "2024-03-05"],
    ["2024년 3월 5일", "2024-03-05"],
    ["검진일", null],
  ])("%s → %s", (input, expected) => {
    expect(parseLooseDate(input)).toBe(expected);
  });
});

describe("건강보험공단 결과 변환 (fromNhisRecord)", () => {
  it("공단 결과표 항목명을 지표로 바꾸고, 혈압·단위 붙은 값을 나눈다", () => {
    const raw = fromNhisRecord({
      검진일자: "20260315",
      신장: "165.2",
      체중: 62,
      "허리 둘레": "80",
      혈압: "128/82",
      "식전혈당(공복혈당)": "98 mg/dL",
      총콜레스테롤: "195",
      "HDL 콜레스테롤": "55",
      트리글리세라이드: "120",
      "혈청지오티(AST)": "24",
      "혈청지피티(ALT)": "20",
      "감마지티피(γ-GTP)": "30",
      혈청크레아티닌: "0.8",
      "신사구체여과율(e-GFR)": "95",
      요단백: "음성",
      혈색소: "13.5",
    });
    expect(raw.checkupDate).toBe("2026-03-15");
    const byMetric = Object.fromEntries(raw.items.map((i) => [i.metric, i]));
    expect(byMetric.SBP.value).toBe(128);
    expect(byMetric.DBP.value).toBe(82);
    expect(byMetric.FASTING_GLUCOSE).toEqual({
      metric: "FASTING_GLUCOSE",
      value: 98,
      unit: "mg/dL",
    });
    expect(byMetric.HEIGHT.value).toBe(165.2);
    expect(byMetric.AST.value).toBe(24);
    expect(byMetric.GGT.value).toBe(30);
    expect(byMetric.EGFR.value).toBe(95);
    expect(byMetric.HEMOGLOBIN.value).toBe(13.5);
    // 앱에서 쓰지 않는 항목(요단백)은 무시 — 15개 = 14개 항목 + 혈압 2개로 나눔
    expect(raw.items).toHaveLength(15);

    const out = normalizeCheckup(raw, TODAY);
    expect(out.values.WAIST).toBe(80);
    expect(out.values.TRIGLYCERIDE).toBe(120);
  });

  it("항목명 비교는 공백·괄호·대소문자를 무시한다", () => {
    expect(metricForLabel("LDL-콜레스테롤")).toBe("LDL");
    expect(metricForLabel("ALT (SGPT)")).toBe("ALT");
    expect(metricForLabel("신사구체여과율(e-GFR)")).toBe("EGFR");
    expect(metricForLabel("요단백(소변)")).toBeUndefined();
    expect(metricForLabel("흉부방사선")).toBeUndefined();
  });

  it("모든 가져오기 지표에 별칭이 있다", () => {
    for (const code of IMPORTABLE_CODES)
      expect(NHIS_FIELD_ALIASES[code].length).toBeGreaterThan(0);
  });
});

describe("검진기관 FHIR 변환 (fromFhirObservations)", () => {
  const obs = (
    loinc: string,
    value: number,
    unit: string,
    date = "2026-03-15T09:00:00+09:00",
    status = "final",
  ) => ({
    resourceType: "Observation",
    status,
    code: { coding: [{ system: "http://loinc.org", code: loinc }] },
    effectiveDateTime: date,
    valueQuantity: { value, unit, code: unit },
  });

  it("LOINC 코드로 지표를 찾고, 혈압 패널 component도 읽는다", () => {
    const raw = fromFhirObservations([
      obs("2093-3", 195, "mg/dL"),
      obs("4548-4", 5.6, "%"),
      {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "85354-9" }] },
        effectiveDateTime: "2026-03-15T09:00:00+09:00",
        component: [
          {
            code: { coding: [{ system: "http://loinc.org", code: "8480-6" }] },
            valueQuantity: { value: 126, code: "mm[Hg]" },
          },
          {
            code: { coding: [{ system: "http://loinc.org", code: "8462-4" }] },
            valueQuantity: { value: 78, code: "mm[Hg]" },
          },
        ],
      },
    ]);
    expect(raw.checkupDate).toBe("2026-03-15");
    expect(raw.items).toEqual(
      expect.arrayContaining([
        { metric: "TOTAL_CHOLESTEROL", value: 195, unit: "mg/dL" },
        { metric: "HBA1C", value: 5.6, unit: "%" },
        { metric: "SBP", value: 126, unit: "mm[Hg]" },
        { metric: "DBP", value: 78, unit: "mm[Hg]" },
      ]),
    );
    const out = normalizeCheckup(raw, TODAY);
    expect(out.values).toMatchObject({ SBP: 126, DBP: 78, HBA1C: 5.6 });
  });

  it("같은 항목은 가장 최근 값, 취소된 결과는 제외한다", () => {
    const raw = fromFhirObservations([
      obs("2085-9", 40, "mg/dL", "2024-03-01"),
      obs("2085-9", 52, "mg/dL", "2026-03-01"),
      obs("2571-8", 900, "mg/dL", "2026-04-01", "cancelled"),
      obs("9999-9", 1, "x"),
    ]);
    expect(raw.items).toEqual([{ metric: "HDL", value: 52, unit: "mg/dL" }]);
    expect(raw.checkupDate).toBe("2026-03-01");
  });
});

describe("사진 판독 형식", () => {
  it("JSON Schema와 zod 스키마의 지표 목록이 같다", () => {
    expect(
      photoReadJsonSchema.properties.items.items.properties.metric.enum,
    ).toEqual([...IMPORTABLE_CODES]);
    expect(
      photoReadSchema.safeParse({
        isCheckupResult: true,
        checkupDate: null,
        items: [{ metric: "BMI", value: 24, unit: "" }],
      }).success,
    ).toBe(false);
  });

  it("파일 시그니처로 이미지 형식을 판별한다", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
    expect(
      sniffImageType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF0000WEBPVP8 "))).toBe(
      "image/webp",
    );
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("AnthropicCheckupPhotoReader (가짜 클라이언트)", () => {
  const read = {
    isCheckupResult: true,
    checkupDate: "2026-03-15",
    items: [{ metric: "LDL", value: 130, unit: "mg/dL" }],
  };
  const image = {
    data: new Uint8Array([0xff, 0xd8, 0xff]),
    mediaType: "image/jpeg" as const,
  };

  it("이미지를 base64로 보내고 구조화 출력·fallbacks를 설정한다", async () => {
    const create = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(read) }],
    });
    const reader = new AnthropicCheckupPhotoReader(
      "claude-opus-5",
      create as never,
    );
    await expect(reader.read(image)).resolves.toEqual(read);
    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5");
    expect(req.fallbacks).toBe("default");
    expect(req.output_config.effort).toBe("medium");
    expect(req.output_config.format.schema).toBe(photoReadJsonSchema);
    const [img, text] = req.messages[0].content;
    expect(img).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "/9j/" },
    });
    expect(text.type).toBe("text");
  });

  it("거절·형식 오류는 LlmProviderError로 알린다", async () => {
    const cases: [object, string][] = [
      [{ stop_reason: "refusal" }, "refusal"],
      [{ content: [{ type: "text", text: "{}" }] }, "invalid-output"],
    ];
    for (const [over, kind] of cases) {
      const reader = new AnthropicCheckupPhotoReader(
        "m",
        vi.fn().mockResolvedValue({
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(read) }],
          ...over,
        }) as never,
      );
      const err = await reader.read(image).catch((e) => e);
      expect(err).toBeInstanceOf(LlmProviderError);
      expect(err.kind).toBe(kind);
    }
  });
});

describe("API 오류 원인 기록", () => {
  it("상태 코드·오류 종류·오류 문구를 담는다", async () => {
    const apiError = new Anthropic.AuthenticationError(
      401,
      {
        type: "error",
        error: { type: "authentication_error", message: "invalid x-api-key" },
      },
      undefined,
      new Headers(),
    );
    const reader = new AnthropicCheckupPhotoReader(
      "m",
      vi.fn().mockRejectedValue(apiError) as never,
    );
    const err = await reader
      .read({
        data: new Uint8Array([0xff, 0xd8, 0xff]),
        mediaType: "image/jpeg",
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(LlmProviderError);
    expect(err.kind).toBe("api");
    expect(err.message).toBe(
      "status 401 authentication_error invalid x-api-key",
    );
  });
});

describe("판독 결과 확인 폼", () => {
  it("비운 항목은 제외하고, 범위·혈압 순서를 검사한다", () => {
    const ok = confirmImportFormSchema.safeParse({
      importId: "imp1",
      checkupDate: "2026-03-15",
      HEIGHT: "165.2",
      LDL: "130",
    });
    expect(ok.success).toBe(true);
    expect(importedValuesOf(ok.data!)).toEqual({ HEIGHT: 165.2, LDL: 130 });

    const bad = confirmImportFormSchema.safeParse({
      importId: "imp1",
      SBP: "80",
      DBP: "90",
      LDL: "9999",
    });
    expect(bad.success).toBe(false);
    const paths = bad.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["LDL"]));

    expect(confirmImportFormSchema.safeParse({ LDL: "130" }).success).toBe(
      false,
    );
  });
});

describe("외부 연동 커넥터", () => {
  it("연동 전에는 모두 '준비 중'이고 호출하면 NotConfigured", async () => {
    const list = listCheckupConnectors();
    expect(list.map((c) => c.id)).toEqual(["nhis", "checkup-center"]);
    for (const c of list) {
      expect(c.status()).toBe("planned");
      await expect(c.fetchLatest({ accessToken: "t" })).rejects.toBeInstanceOf(
        ConnectorNotConfiguredError,
      );
    }
  });

  it("transport를 끼우면 응답을 공통 형식으로 바꾼다", async () => {
    const nhis = createNhisConnector({
      fetchLatest: async () => ({ 검진일자: "2026.03.15", 혈압: "120/80" }),
    });
    expect(nhis.status()).toBe("available");
    expect(nhis.source).toBe("NHIS");
    await expect(nhis.fetchLatest({ accessToken: "t" })).resolves.toEqual({
      checkupDate: "2026-03-15",
      items: [
        { metric: "SBP", value: 120, unit: "mmHg" },
        { metric: "DBP", value: 80, unit: "mmHg" },
      ],
    });

    const center = createCheckupCenterConnector({
      fetchLatest: async () => [
        {
          resourceType: "Observation",
          code: { coding: [{ system: "http://loinc.org", code: "2085-9" }] },
          valueQuantity: { value: 50, unit: "mg/dL" },
        },
      ],
    });
    expect(center.source).toBe("CHECKUP_CENTER");
    await expect(center.fetchLatest({ accessToken: "t" })).resolves.toEqual({
      checkupDate: null,
      items: [{ metric: "HDL", value: 50, unit: "mg/dL" }],
    });
  });
});
