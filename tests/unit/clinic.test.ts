import { describe, expect, it } from "vitest";
import {
  adherence,
  agpProfile,
  patientFlag,
  reportPeriod,
  symptomSummary,
  weightTrend,
  type CheckInLite,
} from "@/domain/glp1/clinic";
import type { DoseRecord } from "@/domain/glp1/dosing";
import { getDrug } from "@/domain/glp1/drugs";
import { emptySymptoms } from "@/domain/glp1/symptoms";
import { kstDateTime, MINUTE_MS } from "@/domain/glp1/time";

// 가상 데이터 (실제 환자 정보 아님)
const TODAY = "2026-10-20";
const weekly = getDrug("TIRZEPATIDE_WEEKLY")!;
const daily = getDrug("LIRAGLUTIDE_DAILY_OB")!;
const taken = (
  date: string,
  status: DoseRecord["status"] = "TAKEN",
): DoseRecord => ({
  takenAt: kstDateTime(date, "09:00"),
  status,
  doseMg: 2.5,
  site: null,
});

describe("복용률", () => {
  it("예정 횟수 대비 기록 횟수, 오늘 예정분은 기록 전이면 세지 않는다", () => {
    // 9/22 시작, 매주 화요일 예정: 9/22, 9/29, 10/6, 10/13, 10/20(오늘)
    const a = adherence(
      weekly,
      "2026-09-22",
      [taken("2026-09-22"), taken("2026-09-30"), taken("2026-10-13")],
      "2026-09-22",
      TODAY,
    );
    expect(a).toEqual({ expected: 4, taken: 3, missedRecorded: 0, rate: 0.75 });
    // 오늘 기록하면 오늘 회차도 센다
    const b = adherence(
      weekly,
      "2026-09-22",
      [taken("2026-10-20")],
      "2026-10-14",
      TODAY,
    );
    expect(b.expected).toBe(1);
    expect(b.rate).toBe(1);
  });

  it("기간이 첫 투약일 전이면 null, 초과 기록은 100%로 자른다", () => {
    expect(
      adherence(weekly, "2026-10-25", [], "2026-10-01", TODAY).rate,
    ).toBeNull();
    const a = adherence(
      daily,
      "2026-10-18",
      ["2026-10-18", "2026-10-18", "2026-10-19"].map((d) => taken(d)),
      "2026-10-18",
      "2026-10-19",
    );
    expect(a.rate).toBe(1);
  });
});

describe("AGP", () => {
  it("시간대별 백분위, 측정이 적은 시간대는 null", () => {
    const pts = Array.from({ length: 5 }, (_, day) =>
      [100, 110, 120, 130].map((v, i) => ({
        t:
          kstDateTime(`2026-10-1${day}`, "08:00").getTime() +
          i * 15 * MINUTE_MS,
        mgdl: v + day,
      })),
    ).flat();
    const agp = agpProfile(pts);
    expect(agp).toHaveLength(24);
    expect(agp[7]).toBeNull();
    expect(agp[8]).toMatchObject({ hour: 8, n: 20, p50: 117 });
    expect(agp[8]!.p5).toBeLessThan(agp[8]!.p25);
    expect(agp[8]!.p95).toBeGreaterThan(agp[8]!.p75);
  });
});

describe("증상·체중 요약", () => {
  const c = (
    date: string,
    patch: Partial<CheckInLite["symptoms"]>,
    weightKg: number | null = null,
  ): CheckInLite => ({
    date,
    symptoms: { ...emptySymptoms(), ...patch },
    appetite: 4,
    weightKg,
    triage: patch.VOMITING === 2 ? "CONTACT_CLINIC" : "SELF_CARE",
  });
  const list = [
    c("2026-10-14", { NAUSEA: 2 }, 90),
    c("2026-10-15", { NAUSEA: 1, VOMITING: 2 }),
    c("2026-10-18", { CONSTIPATION: 2 }, 88.6),
    c("2026-09-01", { NAUSEA: 3 }, 95),
  ];

  it("기간 안 증상 일수·보통 이상 일수·위장관 증상 일수", () => {
    const s = symptomSummary(list, "2026-10-14", TODAY);
    expect(s.checkInDays).toBe(3);
    expect(s.periodDays).toBe(7);
    expect(s.bySymptom.NAUSEA).toEqual({ days: 2, moderateDays: 1, max: 2 });
    expect(s.giModerateDays).toBe(2);
    expect(s.escalatedDays).toBe(1);
    expect(s.avgAppetite).toBe(4);
  });

  it("체중은 기간 안 첫·마지막 기록으로", () => {
    expect(weightTrend(list, "2026-10-14", TODAY)).toMatchObject({
      change: -1.4,
      changePct: -1.6,
    });
    expect(weightTrend(list, "2026-10-19", TODAY)).toBeNull();
  });
});

describe("환자 목록 표시", () => {
  const base = {
    today: TODAY,
    openAlerts: [],
    adherenceRate: 1,
    lastCheckIn: TODAY,
    enrolledOn: "2026-09-01",
  };
  it("위험 신호 > 복용률·체크인 > 양호", () => {
    expect(patientFlag(base).flag).toBe("OK");
    expect(patientFlag({ ...base, adherenceRate: 0.5 }).flag).toBe("WATCH");
    expect(patientFlag({ ...base, lastCheckIn: "2026-10-10" }).reasons).toEqual(
      [{ kind: "no-check-in", days: 10 }],
    );
    expect(
      patientFlag({ ...base, openAlerts: ["LOW_GLUCOSE"], adherenceRate: 0.5 })
        .flag,
    ).toBe("ALERT");
    // 막 등록한 환자는 체크인이 없어도 관찰 대상이 아니다
    expect(
      patientFlag({ ...base, lastCheckIn: null, enrolledOn: "2026-10-18" })
        .flag,
    ).toBe("OK");
  });

  it("리포트 기간은 지난 내원일(오늘 제외) 이후, 최대 90일", () => {
    expect(reportPeriod(TODAY, "2026-09-01", ["2026-10-06", TODAY])).toEqual({
      from: "2026-10-06",
      to: TODAY,
      sinceVisit: "2026-10-06",
    });
    expect(reportPeriod(TODAY, "2026-01-01", []).from).toBe("2026-07-23");
  });
});
