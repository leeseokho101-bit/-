import { describe, expect, it } from "vitest";
import { isWithinInputRange } from "@/domain/health-snapshot/metrics";
import { surveyAnswersSchema } from "@/domain/health-snapshot/survey";
import { sampleUsers } from "@/dev/samples";
import {
  checkupFormSchema,
  profileFormSchema,
} from "@/features/assessment/schemas";

describe("sample users", () => {
  it("A~E 5명이고 이메일이 겹치지 않는다", () => {
    expect(sampleUsers.map((s) => s.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(new Set(sampleUsers.map((s) => s.email)).size).toBe(5);
  });

  it("실제 도메인이 아닌 .invalid 이메일과 '가상' 이름만 사용한다", () => {
    for (const s of sampleUsers) {
      expect(s.email.endsWith("@example.invalid")).toBe(true);
      expect(s.displayName.startsWith("가상")).toBe(true);
      for (const m of s.medications)
        expect(m.name.startsWith("가상")).toBe(true);
    }
  });

  it.each(sampleUsers)(
    "사용자 $id 는 실제 입력과 같은 검증을 통과한다",
    (s) => {
      const str = (v: number | undefined) =>
        v === undefined ? undefined : String(v);
      expect(
        profileFormSchema.safeParse({
          displayName: s.displayName,
          sex: s.sex,
          birthDate: s.birthDate,
          HEIGHT: str(s.metrics.HEIGHT),
          WEIGHT: str(s.metrics.WEIGHT),
          WAIST: str(s.metrics.WAIST),
        }).success,
      ).toBe(true);

      const { HEIGHT: _h, WEIGHT: _w, ...checkup } = s.metrics;
      const r = checkupFormSchema.safeParse({
        checkupDate: s.checkupDate,
        ...Object.fromEntries(
          Object.entries(checkup).map(([k, v]) => [k, String(v)]),
        ),
      });
      expect(r.error?.issues ?? []).toEqual([]);

      for (const [code, value] of Object.entries(s.metrics)) {
        expect(isWithinInputRange(code as never, value)).toBe(true);
      }
      expect(surveyAnswersSchema.safeParse(s.survey).success).toBe(true);
    },
  );

  it("건강상태가 서로 다르게 구성되어 있다 (기대 우선순위가 모두 다름)", () => {
    const focus = sampleUsers.map((s) => s.expectedFocus.join(","));
    expect(new Set(focus).size).toBe(5);
  });
});
