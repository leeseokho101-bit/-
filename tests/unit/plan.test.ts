import { describe, expect, it } from "vitest";
import { compareDomains } from "@/domain/analysis/compare";
import { analyze } from "@/domain/analysis/engine";
import type { DomainResult } from "@/domain/analysis/types";
import { checkText } from "@/domain/narrative/safety";
import {
  buildCarePlan,
  currentWeekOf,
  weeklyFeedback,
} from "@/domain/plan/builder";
import { mergeCoaching } from "@/domain/plan/coaching";
import { actionLibrary, milestoneActions } from "@/domain/plan/library";
import { sampleUsers } from "@/dev/samples";
import { snap, snapshotOf } from "./engine-helpers";

const planOf = (id: string) =>
  buildCarePlan(analyze(snapshotOf(sampleUsers.find((s) => s.id === id)!)));

describe("12주 계획 생성", () => {
  it("12주 · 1~4 기초 / 5~8 운동·식습관 / 9~12 유지로 구성된다", () => {
    const { weeks } = planOf("C");
    expect(weeks).toHaveLength(12);
    expect(weeks.map((w) => w.phase)).toEqual([
      ...Array(4).fill("FOUNDATION"),
      ...Array(4).fill("ACTIVATION"),
      ...Array(4).fill("MAINTENANCE"),
    ]);
  });

  it("TOP 3 영역을 중심으로 하고, 각 주차에 목표·실천·체크·코칭이 있다", () => {
    const { focus, weeks } = planOf("C");
    expect(focus).toEqual(["GLYCEMIC", "WEIGHT", "METABOLIC"]);
    for (const w of weeks) {
      expect(w.goal).toBeTruthy();
      expect(w.coaching).toBeTruthy();
      expect(w.actions.length).toBeGreaterThanOrEqual(3);
      expect(w.checks.map((c) => c.id)).toEqual(w.actions.map((a) => a.id));
    }
  });

  it("단계 안에서 실천 항목이 점진적으로 늘어난다", () => {
    const { weeks } = planOf("B");
    const perDomain = (i: number) =>
      weeks[i].actions.filter((a) => a.domain === "WEIGHT").length;
    expect([perDomain(1), perDomain(2)]).toEqual([1, 2]);
  });

  it("1·8·12주차에는 시작 기록·중간 점검·재분석 항목이 있다", () => {
    const { weeks } = planOf("E");
    for (const n of [1, 8, 12]) {
      expect(weeks[n - 1].actions[0].text).toBe(milestoneActions[n].text);
    }
  });

  it("겹치는 실천(예: 30분 걷기)은 한 주에 한 번만 나온다", () => {
    for (const s of sampleUsers) {
      for (const w of buildCarePlan(analyze(snapshotOf(s))).weeks) {
        const texts = w.actions.map((a) => a.text);
        expect(new Set(texts).size).toBe(texts.length);
      }
    }
  });

  it("비흡연자에게는 금연 항목을 넣지 않고, 흡연자에게는 넣는다", () => {
    const smoker = planOf("D")
      .weeks.flatMap((w) => w.actions.map((a) => a.text))
      .join(" ");
    expect(smoker).toContain("금연");
    const nonSmoker = buildCarePlan(
      analyze(
        snap({
          survey: {
            smoking: { status: "NEVER" },
            stress: { level: 5 },
            alcohol: { frequency: "RARELY" },
          },
        }),
      ),
    );
    expect(nonSmoker.focus).toContain("LIFESTYLE");
    expect(
      nonSmoker.weeks.flatMap((w) => w.actions.map((a) => a.text)).join(" "),
    ).not.toContain("금연");
  });

  it("관리 필요 영역이 없어도(가상 A) 유지 중심 계획을 만든다", () => {
    expect(planOf("A").focus).toEqual(["EXERCISE", "SLEEP", "DIET"]);
  });

  it("같은 분석 결과 → 같은 계획", () => {
    expect(planOf("E")).toEqual(planOf("E"));
  });

  it("모든 실천·체크·코칭 문구가 안전 검사를 통과하고 약 관련 지시가 없다", () => {
    const texts = [
      ...Object.values(actionLibrary).flatMap((phases) =>
        Object.values(phases)
          .flat()
          .flatMap((a) => [a.text, a.check]),
      ),
      ...sampleUsers.flatMap((s) =>
        planOf(s.id).weeks.flatMap((w) => [w.goal, w.coaching]),
      ),
    ];
    for (const t of texts) {
      expect(checkText(t), t).toEqual({ ok: true });
      expect(t).not.toMatch(/복용|처방|약을/);
    }
  });
});

describe("주차 계산·피드백", () => {
  const start = new Date("2026-09-01T00:00:00Z");
  it.each([
    ["2026-09-01", 1],
    ["2026-09-07", 1],
    ["2026-09-08", 2],
    ["2026-11-23", 12],
    ["2027-03-01", 12],
    ["2026-08-20", 1],
  ])("%s → %i주차", (d, w) => {
    expect(currentWeekOf(start, new Date(`${d}T09:00:00Z`))).toBe(w);
  });

  it("실천율에 따라 격려 문구가 달라지고, 오르면 알려준다", () => {
    expect(weeklyFeedback(1, null)).toContain("정말 잘하고");
    expect(weeklyFeedback(0.5, 0.2)).toContain("지난주보다 실천율이 올랐어요");
    expect(weeklyFeedback(0, null)).toContain("다시 시작");
    for (const r of [0, 0.3, 0.6, 0.9])
      expect(checkText(weeklyFeedback(r, 0)).ok).toBe(true);
  });
});

describe("LLM 코칭 병합", () => {
  it("안전한 메시지만 교체하고 나머지는 템플릿 유지", () => {
    const { weeks } = planOf("C");
    const { weeks: merged, replaced } = mergeCoaching(weeks, {
      weeks: [
        { week: 1, message: "첫 주, 식후 10분 걷기부터 가볍게 시작해 봐요." },
        { week: 2, message: "당뇨병입니다. 약을 중단하세요." },
      ],
    });
    expect(merged[0].coaching).toBe(
      "첫 주, 식후 10분 걷기부터 가볍게 시작해 봐요.",
    );
    expect(merged[1].coaching).toBe(weeks[1].coaching);
    expect(replaced).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // 실천 항목은 LLM이 바꿀 수 없다
    expect(merged.map((w) => w.actions)).toEqual(weeks.map((w) => w.actions));
  });
});

describe("이전 분석과 비교", () => {
  const d = (domain: DomainResult["domain"], status: DomainResult["status"]) =>
    ({ domain, status }) as DomainResult;
  it("상태 변화 방향을 계산한다", () => {
    const changes = compareDomains(
      [
        d("WEIGHT", "MANAGEMENT_NEEDED"),
        d("SLEEP", "NORMAL"),
        d("KIDNEY", "DATA_INSUFFICIENT"),
        d("DIET", "GOOD"),
      ],
      [
        d("WEIGHT", "ATTENTION"),
        d("SLEEP", "ATTENTION"),
        d("KIDNEY", "GOOD"),
        d("DIET", "GOOD"),
      ],
    );
    expect(changes.map((c) => [c.domain, c.direction])).toEqual([
      ["WEIGHT", "improved"],
      ["SLEEP", "worsened"],
      ["KIDNEY", "unknown"],
      ["DIET", "same"],
    ]);
  });
});
