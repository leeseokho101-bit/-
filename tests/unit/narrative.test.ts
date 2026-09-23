import { describe, expect, it, vi } from "vitest";
import { findingText } from "@/content/findings";
import { analyze } from "@/domain/analysis/engine";
import { buildNarrativeInput, withValue } from "@/domain/narrative/input";
import { josa } from "@/lib/josa";
import { mergeNarrative } from "@/domain/narrative/merge";
import { checkText } from "@/domain/narrative/safety";
import {
  buildTemplateNarrative,
  CONSULT_SENTENCE,
} from "@/domain/narrative/templates";
import {
  llmNarrativeJsonSchema,
  llmNarrativeSchema,
  type LlmNarrative,
} from "@/domain/narrative/types";
import { FREQUENCIES } from "@/domain/health-snapshot/survey";
import { sampleUsers } from "@/dev/samples";
import {
  AnthropicNarrativeProvider,
  NarrativeProviderError,
} from "@/server/ai/provider";
import { snap, snapshotOf } from "./engine-helpers";

function narrativeFor(id: string) {
  const s = sampleUsers.find((x) => x.id === id)!;
  const snapshot = snapshotOf(s);
  const output = analyze(snapshot);
  const input = buildNarrativeInput(output, snapshot.demographics);
  return { output, input, template: buildTemplateNarrative(output, input) };
}

function allTexts(n: ReturnType<typeof buildTemplateNarrative>): string[] {
  return [
    n.summary,
    n.encouragement,
    ...Object.values(n.domains),
    ...n.priorities.flatMap((p) => [p.why, p.firstStep]),
  ];
}

describe("판정 근거 문구 카탈로그", () => {
  it("엔진이 만들 수 있는 모든 messageKey에 설명 문구가 있다", () => {
    // 경계값을 폭넓게 바꿔 가며 엔진을 실행해 모든 키를 수집
    const keys = new Set<string>();
    const values = {
      BMI: [17, 21, 24, 27, 32],
      WAIST: [70, 83, 88, 95],
      SBP: [110, 125, 135, 150],
      FASTING_GLUCOSE: [90, 110, 130],
      HBA1C: [5.2, 6, 7],
      LDL: [90, 115, 140, 170],
      TOTAL_CHOLESTEROL: [180, 220, 250],
      HDL: [35, 50, 65],
      TRIGLYCERIDE: [100, 160, 250],
      AST: [20, 45, 60],
      ALT: [20, 45, 60],
      GGT: [20, 40, 70, 90],
      EGFR: [50, 75, 95],
      CREATININE: [0.9, 1.8],
    };
    for (let i = 0; i < 5; i++) {
      for (const sex of ["MALE", "FEMALE"] as const) {
        const metrics = Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, v[i % v.length]]),
        );
        const f = FREQUENCIES[i];
        const out = analyze(
          snap({
            sex,
            metrics: { ...metrics, DBP: 70 + i * 6 },
            survey: {
              exercise: {
                aerobicMinPerWeek: [0, 30, 100, 200, 200][i],
                dailySteps: [2000, 4000, 6000, 9000, 9000][i],
                sessionsPerWeek: [0, 1, 3, 4, 2][i],
                strengthTraining: i % 2 === 0,
              },
              sleep: {
                avgHours: [4, 5.5, 6.5, 7.5, 9.5][i],
                satisfaction: ([1, 2, 3, 4, 5] as const)[i],
                bedtime: ["02:00", "00:30", "23:00", "22:30", "22:00"][i],
              },
              diet: {
                breakfast: f,
                vegetables: f,
                fruits: f,
                lateNightSnack: f,
                eatingOut: f,
                sugaryDrinks: f,
                processedFood: f,
              },
              alcohol: { frequency: f, drinksPerOccasion: [0, 2, 3, 8, 8][i] },
              smoking: {
                status: (
                  ["NEVER", "FORMER", "CURRENT", "NEVER", "CURRENT"] as const
                )[i],
              },
              stress: { level: ([1, 2, 3, 4, 5] as const)[i] },
            },
            managed: i === 2 ? ["BLOOD_PRESSURE"] : [],
          }),
        );
        for (const d of out.domains)
          for (const fd of d.findings) keys.add(fd.messageKey);
      }
    }
    const missing = [...keys].filter((k) => !findingText(k));
    expect(missing).toEqual([]);
    expect(keys.size).toBeGreaterThan(80);
  });
});

describe("LLM 입력 (buildNarrativeInput)", () => {
  it("식별정보 없이 연령대·성별과 엔진 결과만 담는다", () => {
    const { input } = narrativeFor("E");
    const json = JSON.stringify(input);
    expect(input.person).toEqual({ ageGroup: "60대", sex: "남성" });
    expect(json).not.toMatch(
      /example\.invalid|가상 E|1963|birth|email|displayName/,
    );
    expect(input.domains).toHaveLength(10);
  });

  it("수치에는 단위를 붙여 사실 문장을 만든다", () => {
    const { input } = narrativeFor("C");
    const glycemic = input.domains.find((d) => d.code === "GLYCEMIC")!;
    expect(glycemic.facts).toContain(
      "공복혈당(119 mg/dL)이 관심이 필요한 경계 범위에 있어요.",
    );
    expect(glycemic.facts).toContain(
      "당화혈색소(6.2%)가 관심이 필요한 경계 범위에 있어요.",
    );
    const weight = input.domains.find((d) => d.code === "WEIGHT")!;
    expect(weight.facts[0]).toBe(
      "체질량지수(BMI, 25.3 kg/m²)가 체중관리가 필요한 범위에 있어요.",
    );
  });

  it("'관심' 영역이 '관리 필요' 영역보다 앞서면 이유 힌트를 넣는다 (가상 C)", () => {
    const { input } = narrativeFor("C");
    expect(input.priorities[0].code).toBe("GLYCEMIC");
    expect(input.priorities[0].orderNote).toContain("여러 개 함께 경계 범위");
    expect(input.priorities[1].orderNote).toBeUndefined();
  });
});

describe("조사·수치 표기", () => {
  it("받침에 맞는 조사를 고른다", () => {
    expect(josa("혈당건강", "을/를")).toBe("혈당건강을");
    expect(josa("수면", "은/는")).toBe("수면은");
    expect(josa("체중관리", "은/는")).toBe("체중관리는");
    expect(josa("LDL", "이/가")).toBe("LDL이");
  });

  it("템플릿에 '(를)', '(는)' 같은 병기 조사가 남지 않는다", () => {
    for (const s of sampleUsers) {
      const text = allTexts(narrativeFor(s.id).template).join(" ");
      expect(text).not.toMatch(/\((은|는|을|를|이|가)\)/);
    }
  });

  it("지표 이름 뒤에 수치를 넣는다", () => {
    expect(withValue("AST 수치가 경계 범위에 있어요.", "AST", "45 U/L")).toBe(
      "AST(45 U/L) 수치가 경계 범위에 있어요.",
    );
    expect(
      withValue("혈압이 관리가 필요한 범위에 있어요.", "혈압", "148/94 mmHg"),
    ).toBe("혈압(148/94 mmHg)이 관리가 필요한 범위에 있어요.");
  });
});

describe("템플릿 설명", () => {
  it.each(sampleUsers.map((s) => s.id))(
    "가상 %s: 모든 문장이 안전 검사를 통과한다",
    (id) => {
      const { template, output } = narrativeFor(id);
      expect(Object.keys(template.domains)).toHaveLength(10);
      expect(template.priorities.map((p) => p.domain)).toEqual(
        output.priorities.map((p) => p.domain),
      );
      for (const t of allTexts(template))
        expect(checkText(t)).toEqual({ ok: true });
    },
  );

  it("A는 유지 중심 요약, E는 관리 필요 개수를 요약한다", () => {
    expect(narrativeFor("A").template.summary).toContain(
      "특별히 관리가 필요한 영역이 없어요",
    );
    expect(narrativeFor("E").template.summary).toContain(
      "관리가 필요한 영역 10개",
    );
  });

  it("관리 필요 검진 영역에는 의료진 상담 문구를 붙인다", () => {
    expect(narrativeFor("E").template.domains.GLYCEMIC).toContain(
      CONSULT_SENTENCE,
    );
  });

  it("현재 흡연자의 생활습관 첫 실천은 금연 지원 안내", () => {
    const p = narrativeFor("D").template.priorities.find(
      (x) => x.domain === "LIFESTYLE",
    )!;
    expect(p.firstStep).toContain("금연");
  });
});

describe("안전 검사 (금지 표현)", () => {
  it.each([
    "당뇨병입니다.",
    "고혈압으로 보입니다.",
    "지방간이 의심됩니다.",
    "심장병 위험이 70%입니다.",
    "발병 확률은 30%로 높습니다.",
    "약을 중단하세요.",
    "혈압약 복용량을 줄이세요.",
    "이 약을 복용하세요.",
    "병원에 갈 필요가 없습니다.",
    "검사는 받지 않아도 됩니다.",
    "대사증후군에 해당합니다.",
  ])("차단: %s", (t) => {
    expect(checkText(t).ok).toBe(false);
  });

  it.each([
    "혈당관리에 관심이 필요한 상태입니다.",
    "생활습관 개선을 고려해볼 수 있습니다.",
    "정확한 판단은 의료진과 상담하시기 바랍니다.",
    "하루 걸음 수를 1,000보 늘려 보세요.",
    "혈압이 관리가 필요한 범위에 있어요. 현재 관리 중인 부분이에요.",
    "허리둘레를 한 달에 한 번 재 보는 것도 도움이 돼요.",
  ])("허용: %s", (t) => {
    expect(checkText(t)).toEqual({ ok: true });
  });

  it("너무 긴 문장은 거부한다", () => {
    expect(checkText("가".repeat(401))).toEqual({
      ok: false,
      reason: "too-long",
    });
  });
});

function llmFrom(
  template: ReturnType<typeof buildTemplateNarrative>,
): LlmNarrative {
  return {
    summary: "AI 요약입니다.",
    domains: Object.keys(template.domains).map((code) => ({
      code: code as never,
      explanation: `AI ${code}`,
    })),
    priorities: template.priorities.map((p) => ({
      code: p.domain,
      why: `AI 이유 ${p.domain}`,
      firstStep: "AI 첫 실천",
    })),
    encouragement: "AI 격려",
  };
}

describe("LLM 설명 병합", () => {
  it("모든 문장이 안전하면 LLM 문구를 쓴다", () => {
    const { template } = narrativeFor("C");
    const { narrative, report } = mergeNarrative(llmFrom(template), template);
    expect(narrative.source).toBe("llm");
    expect(report.replaced).toEqual([]);
    expect(narrative.summary).toBe("AI 요약입니다.");
  });

  it("금지 표현이 있는 문장만 템플릿으로 바꾼다", () => {
    const { template } = narrativeFor("C");
    const llm = llmFrom(template);
    llm.summary = "당뇨병입니다. 약을 중단하세요.";
    llm.domains[3].explanation = "당뇨병 위험이 60%입니다.";
    const { narrative, report } = mergeNarrative(llm, template);
    expect(narrative.source).toBe("mixed");
    expect(narrative.summary).toBe(template.summary);
    expect(narrative.domains.GLYCEMIC).toBe(template.domains.GLYCEMIC);
    expect(narrative.domains.WEIGHT).toBe("AI WEIGHT");
    expect(report.replaced).toEqual([
      "domain.GLYCEMIC:probability",
      "summary:disease-assertion",
    ]);
  });

  it("LLM이 순서를 바꾸거나 다른 영역을 넣어도 엔진 우선순위를 따른다", () => {
    const { template } = narrativeFor("C");
    const llm = llmFrom(template);
    llm.priorities = [
      { code: "KIDNEY", why: "엉뚱한 영역", firstStep: "x" },
      ...[...llm.priorities].reverse().slice(0, 2),
    ];
    const { narrative } = mergeNarrative(llm, template);
    expect(narrative.priorities.map((p) => p.domain)).toEqual(
      template.priorities.map((p) => p.domain),
    );
    expect(narrative.priorities.some((p) => p.why === "엉뚱한 영역")).toBe(
      false,
    );
    // 빠진 1개는 템플릿 문구
    expect(narrative.source).toBe("mixed");
  });
});

describe("구조화 출력 스키마", () => {
  it("JSON Schema와 zod 스키마의 필수 필드가 같다", () => {
    expect([...llmNarrativeJsonSchema.required].sort()).toEqual(
      Object.keys(llmNarrativeSchema.shape).sort(),
    );
  });
});

describe("AnthropicNarrativeProvider (가짜 클라이언트)", () => {
  const { input, template } = narrativeFor("C");
  const response = (over: object) => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(llmFrom(template)) }],
    ...over,
  });

  it("엔진 JSON만 보내고 fallbacks·structured output을 설정한다", async () => {
    const create = vi.fn().mockResolvedValue(response({}));
    const provider = new AnthropicNarrativeProvider(
      "claude-opus-5",
      create as never,
    );
    const out = await provider.generateReportNarrative(input);
    expect(out.summary).toBe("AI 요약입니다.");

    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req).not.toHaveProperty("temperature");
    expect(req.messages[0].content).toContain(JSON.stringify(input));
  });

  it("거절(refusal)·잘림·형식 오류는 오류로 알린다", async () => {
    for (const [over, kind] of [
      [{ stop_reason: "refusal", content: [] }, "refusal"],
      [{ stop_reason: "max_tokens" }, "truncated"],
      [{ content: [{ type: "text", text: "not json" }] }, "invalid-output"],
      [
        { content: [{ type: "text", text: '{"summary":"x"}' }] },
        "invalid-output",
      ],
    ] as const) {
      const provider = new AnthropicNarrativeProvider(
        "m",
        vi.fn().mockResolvedValue(response(over)) as never,
      );
      await expect(
        provider.generateReportNarrative(input),
      ).rejects.toMatchObject({ kind });
    }
  });

  it("API 오류는 NarrativeProviderError로 감싼다", async () => {
    const provider = new AnthropicNarrativeProvider(
      "m",
      vi.fn().mockRejectedValue(new Error("network")) as never,
    );
    await expect(
      provider.generateReportNarrative(input),
    ).rejects.toBeInstanceOf(NarrativeProviderError);
  });
});
