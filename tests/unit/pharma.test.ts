import { describe, expect, it } from "vitest";
import {
  channelByRegion,
  dropoutSummary,
  monthlyEnrollments,
  persistenceCurve,
  rate,
  suppress,
  toCourse,
  type CourseInput,
} from "@/domain/pharma/stats";
import { addDaysIso } from "@/domain/glp1/time";

// 가상 데이터 (실제 의원·환자 정보 아님)
const TODAY = "2026-10-20";
const steps = [2.5, 5, 7.5, 10, 12.5, 15] as const;

/** start부터 매주 n번 투약, dose 함수로 회차별 용량 */
function course(
  start: string,
  n: number,
  opts: Partial<CourseInput> & { dose?: (i: number) => number } = {},
): CourseInput {
  return {
    drugCode: "TIRZEPATIDE_WEEKLY",
    intervalDays: 7,
    doseSteps: steps,
    taken: Array.from({ length: n }, (_, i) => ({
      date: addDaysIso(start, i * 7),
      doseMg: opts.dose?.(i) ?? 2.5,
    })),
    stopped: null,
    giModerateDates: [],
    alertDates: [],
    ...opts,
  };
}

describe("작은 숫자 가리기", () => {
  it("5 미만 칸은 가리고, 비율은 분모 10 이상만", () => {
    expect(suppress(4)).toBeNull();
    expect(suppress(5)).toBe(5);
    expect(rate(3, 9)).toBeNull();
    expect(rate(3, 10)).toBe(30);
  });
});

describe("채널 현황", () => {
  const clinic = (id: string, region: string | null) => ({
    id,
    region,
    createdOn: "2026-09-01",
  });
  const patients = (clinicId: string, n: number, active = true) =>
    Array.from({ length: n }, () => ({
      clinicId,
      region: null,
      enrolledOn: "2026-10-01",
      lastActivity: active ? "2026-10-18" : "2026-08-01",
      stopped: false,
    }));

  it("의원이 3곳 미만인 지역은 합치고, 의원별 숫자는 만들지 않는다", () => {
    const rows = channelByRegion(
      [
        clinic("a", "서울"),
        clinic("b", "서울"),
        clinic("c", "서울"),
        clinic("d", "제주"),
        clinic("e", "부산"),
      ],
      [
        ...patients("a", 6),
        ...patients("b", 2),
        ...patients("d", 7),
        ...patients("c", 3, false),
      ],
      TODAY,
    );
    expect(rows).toEqual([
      { region: "서울", clinics: 3, activeClinics: null, activePatients: 8 },
      {
        region: "그 밖의 지역",
        clinics: 2,
        activeClinics: null,
        activePatients: 7,
      },
    ]);
  });

  it("월별 신규 등록 (5 미만 가림, 하나만 가려지면 다른 칸도 가림)", () => {
    const list = patients("a", 12).map((p, i) => ({
      ...p,
      enrolledOn: i < 5 ? "2026-10-02" : i < 6 ? "2026-09-11" : "2026-08-20",
    }));
    // 9월(1명)만 가리면 합계에서 빼서 알 수 있으므로 가장 작은 10월(5명)도 가린다
    expect(monthlyEnrollments(list, TODAY, 3)).toEqual([
      { month: "2026-08", count: 6 },
      { month: "2026-09", count: null },
      { month: "2026-10", count: null },
    ]);
  });
});

describe("투약 경과", () => {
  it("기록 공백이 3주를 넘으면 중단으로 추정 (마지막 투약 + 간격)", () => {
    const c = toCourse(course("2026-08-01", 4), TODAY)!;
    expect(c).toMatchObject({
      status: "STOPPED",
      inferred: true,
      weeks: 4,
      stepAtEnd: 1,
    });
    expect(toCourse(course("2026-10-06", 3), TODAY)).toMatchObject({
      status: "ONGOING",
      weeks: 2,
    });
    expect(toCourse(course("2026-10-06", 0), TODAY)).toBeNull();
  });

  it("환자가 기록한 중단·사유, 증량 후 유지 기간, 중단 전 2주 신호", () => {
    const c = toCourse(
      course("2026-08-04", 6, {
        dose: (i) => (i < 4 ? 2.5 : 5),
        stopped: { date: "2026-09-12", reason: "SIDE_EFFECTS" },
        giModerateDates: ["2026-09-10"],
        alertDates: ["2026-08-01"],
      }),
      TODAY,
    )!;
    expect(c).toMatchObject({
      status: "STOPPED",
      inferred: false,
      reason: "SIDE_EFFECTS",
      stepAtEnd: 2,
      weeksOnLastDose: 1,
      escalated: true,
      preStop: { gi: true, alert: false },
    });
  });
});

describe("지속 복용 분석", () => {
  // 20명: 10명은 12주 넘게 유지, 10명은 2~6주째 중단 (절반은 증량 직후·부작용)
  const cohort = [
    ...Array.from({ length: 10 }, () => course("2026-07-01", 16)),
    ...Array.from({ length: 10 }, (_, i) =>
      course("2026-07-01", 2 + (i % 5), {
        dose: (k) => (i < 5 && k >= 1 ? 5 : 2.5),
        stopped:
          i < 5
            ? {
                date: addDaysIso("2026-07-01", (2 + (i % 5)) * 7),
                reason: "SIDE_EFFECTS",
              }
            : null,
      }),
    ),
  ].map((c) => toCourse(c, TODAY)!);

  it("Kaplan–Meier 곡선은 100%에서 시작해 줄어들고, 위험집단이 10명 미만이면 멈춘다", () => {
    const curve = persistenceCurve(cohort)!;
    expect(curve[0]).toEqual({ week: 0, persisting: 100, atRisk: 20 });
    for (let i = 1; i < curve.length; i++)
      expect(curve[i].persisting).toBeLessThanOrEqual(curve[i - 1].persisting);
    expect(curve.at(-1)!.persisting).toBe(50);
    expect(curve.at(-1)!.week).toBe(12);
    expect(persistenceCurve(cohort.slice(0, 9))).toBeNull();
  });

  it("단계별 이탈·사유·증량 직후 이탈 (작은 칸은 가림)", () => {
    const d = dropoutSummary(cohort)!;
    expect(d.cohort).toBe(20);
    expect(d.stopped).toBe(10);
    expect(d.byStep).toEqual([
      { step: 1, count: 5, medianWeeksOnDose: expect.any(Number) },
      { step: 2, count: 5, medianWeeksOnDose: expect.any(Number) },
    ]);
    expect(d.reasons.find((r) => r.reason === "SIDE_EFFECTS")?.count).toBe(5);
    expect(d.reasons.find((r) => r.reason === "UNRECORDED")?.count).toBe(5);
    expect(d.reasons.find((r) => r.reason === "COST")?.count).toBeNull();
    // 증량 후 이탈 5명 → 분모 10 미만이라 비율을 내지 않는다
    expect(d.earlyAfterEscalation).toBeNull();
    expect(dropoutSummary(cohort.slice(0, 5))).toBeNull();
  });
});

describe("2차 가리기", () => {
  it("가려진 칸이 하나뿐이면 가장 작은 다른 칸도 가린다 (빼기로 알아내지 못하게)", async () => {
    const { suppressColumn } = await import("@/domain/pharma/stats");
    expect(suppressColumn([10, 3, 7, 0])).toEqual([10, null, null, null]);
    expect(suppressColumn([10, 3, 2, 8])).toEqual([10, null, null, 8]);
    expect(suppressColumn([10, 9, 0])).toEqual([10, 9, null]);
    expect(suppressColumn([4])).toEqual([null]);
  });
});
