import { describe, expect, it } from "vitest";
import {
  alertAction,
  alertContent,
  missedDoseAction,
  careConsentItems,
  careDisclaimer,
  copingTips,
  escalationSupport,
  escalationTip,
  glucoseNote,
  redFlagLabels,
  triageContent,
} from "@/content/care";
import { checkText } from "@/domain/narrative/safety";
import { evaluateAlerts } from "@/domain/glp1/alerts";
import {
  glucoseStats,
  lowEvents,
  mealResponse,
  rangeBand,
  type GlucosePoint,
} from "@/domain/glp1/cgm";
import { parseCgmCsv, parseCgmTimestamp } from "@/domain/glp1/csv";
import { DRUGS, getDrug, isAllowedDose } from "@/domain/glp1/drugs";
import {
  doseSchedule,
  isMissedAlert,
  missedDoseCount,
  suggestNextSite,
  type DoseRecord,
} from "@/domain/glp1/dosing";
import { cleanMealPhotoRead, mealTotals } from "@/domain/glp1/meal";
import {
  emptySymptoms,
  triageCheckIn,
  type SymptomScores,
} from "@/domain/glp1/symptoms";
import { kstDate, kstDateTime, MINUTE_MS } from "@/domain/glp1/time";
import { doseDayProfile, dosePeriods } from "@/domain/glp1/timeline";

// 모든 값은 가상 데이터 (실제 환자 정보 아님)
const TODAY = "2026-10-20";
const weekly = getDrug("TIRZEPATIDE_WEEKLY")!;
const daily = getDrug("LIRAGLUTIDE_DAILY_OB")!;

const dose = (
  date: string,
  status: DoseRecord["status"] = "TAKEN",
  doseMg = 2.5,
  site: DoseRecord["site"] = "ABDOMEN_LEFT",
): DoseRecord => ({
  takenAt: kstDateTime(date, "09:00"),
  status,
  doseMg,
  site: status === "TAKEN" ? site : null,
});

/** start부터 intervalMin 간격으로 값 배열을 측정값으로 */
function series(
  start: Date,
  values: number[],
  intervalMin = 15,
): GlucosePoint[] {
  return values.map((mgdl, i) => ({
    t: start.getTime() + i * intervalMin * MINUTE_MS,
    mgdl,
  }));
}

describe("약 카탈로그", () => {
  it("모든 약이 고유 코드와 투약 간격을 갖고, 용량 단계는 오름차순", () => {
    expect(new Set(DRUGS.map((d) => d.code)).size).toBe(DRUGS.length);
    for (const d of DRUGS) {
      expect([1, 7]).toContain(d.intervalDays);
      expect([...d.doseSteps]).toEqual([...d.doseSteps].sort((a, b) => a - b));
    }
  });

  it("표준 단계가 있으면 그 안에서만, 없으면 범위 안에서 직접 입력", () => {
    expect(isAllowedDose(weekly, 5)).toBe(true);
    expect(isAllowedDose(weekly, 4)).toBe(false);
    const other = getDrug("OTHER_WEEKLY")!;
    expect(isAllowedDose(other, 4)).toBe(true);
    expect(isAllowedDose(other, 50)).toBe(false);
  });
});

describe("투약 일정", () => {
  it("기록이 없으면 첫 투약일, 있으면 마지막 기록 + 간격", () => {
    expect(doseSchedule(weekly, "2026-10-22", [], TODAY)).toEqual({
      nextDue: "2026-10-22",
      daysUntil: 2,
      lastTaken: null,
    });
    const s = doseSchedule(weekly, "2026-10-01", [dose("2026-10-15")], TODAY);
    expect(s).toEqual({
      nextDue: "2026-10-22",
      daysUntil: 2,
      lastTaken: "2026-10-15",
    });
  });

  it("놓침으로 기록하면 그 회차는 지나간 것으로 보고 다음 회차로 넘어간다", () => {
    const s = doseSchedule(
      weekly,
      "2026-10-01",
      [dose("2026-10-08"), dose("2026-10-15", "MISSED")],
      TODAY,
    );
    expect(s.nextDue).toBe("2026-10-22");
    expect(s.lastTaken).toBe("2026-10-08");
  });

  it("놓친 횟수 = 놓침 기록 + 기록 없이 지나간 예정일 (최근 28일)", () => {
    // 10/1 투약 → 10/8, 10/15 예정일이 지나감 (10/22는 아직)
    expect(
      missedDoseCount(weekly, "2026-10-01", [dose("2026-10-01")], TODAY),
    ).toBe(2);
    // 예정일 당일은 놓친 것이 아니다
    expect(
      missedDoseCount(weekly, "2026-10-01", [dose("2026-10-13")], TODAY),
    ).toBe(0);
    // 28일보다 오래된 놓침은 세지 않는다
    expect(
      missedDoseCount(
        weekly,
        "2026-09-01",
        [dose("2026-09-01", "MISSED"), dose("2026-10-15")],
        TODAY,
      ),
    ).toBe(0);
    expect(isMissedAlert(weekly, 2)).toBe(true);
    // 매일 쓰는 약은 기준이 다르다
    expect(
      missedDoseCount(daily, "2026-10-01", [dose("2026-10-17")], TODAY),
    ).toBe(2);
    expect(isMissedAlert(daily, 2)).toBe(false);
    expect(isMissedAlert(daily, 4)).toBe(true);
  });

  it("주사 부위는 안 쓴 부위 → 가장 오래 쉰 부위 순으로 제안", () => {
    expect(suggestNextSite([])).toBe("ABDOMEN_LEFT");
    expect(
      suggestNextSite([dose("2026-10-01", "TAKEN", 2.5, "ABDOMEN_LEFT")]),
    ).toBe("ABDOMEN_RIGHT");
    const all = (
      [
        "ABDOMEN_LEFT",
        "ABDOMEN_RIGHT",
        "THIGH_LEFT",
        "THIGH_RIGHT",
        "ARM_LEFT",
        "ARM_RIGHT",
      ] as const
    ).map((s, i) => dose(`2026-10-0${i + 1}`, "TAKEN", 2.5, s));
    expect(suggestNextSite(all)).toBe("ABDOMEN_LEFT");
    // 놓침 기록은 부위 계산에서 빠진다
    expect(suggestNextSite([...all, dose("2026-10-09", "MISSED")])).toBe(
      "ABDOMEN_LEFT",
    );
  });
});

describe("CGM 지표", () => {
  it("범위 경계: 54·70·180·250", () => {
    expect([53, 54, 69, 70, 180, 181, 250, 251].map(rangeBand)).toEqual([
      "VERY_LOW",
      "LOW",
      "LOW",
      "IN_RANGE",
      "IN_RANGE",
      "HIGH",
      "HIGH",
      "VERY_HIGH",
    ]);
  });

  it("범위별 비율·평균·GMI·변동계수·측정률", () => {
    const pts = series(new Date("2026-10-19T00:00:00+09:00"), [
      ...Array(8).fill(100),
      150,
      200,
    ]);
    const s = glucoseStats(pts, 10 * 15 * MINUTE_MS)!;
    expect(s.pct).toEqual({
      VERY_LOW: 0,
      LOW: 0,
      IN_RANGE: 90,
      HIGH: 10,
      VERY_HIGH: 0,
    });
    expect(s.mean).toBe(115);
    expect(s.gmi).toBeCloseTo(3.31 + 0.02392 * 115, 1);
    expect(s.coveragePct).toBe(100);
    expect(s.cv).toBeGreaterThan(0);
    expect(glucoseStats([], 1000)).toBeNull();
  });

  it("저혈당 구간: 70 미만 15분 이상, 54 미만 15분 이상이면 2단계, 측정이 끊기면 나눈다", () => {
    const start = new Date("2026-10-19T03:00:00+09:00");
    // 5분 간격: 15분(4개) 동안 65 → 1단계
    expect(lowEvents(series(start, [90, 65, 65, 65, 65, 90], 5))).toHaveLength(
      1,
    );
    // 10분만 낮으면 구간 아님
    expect(lowEvents(series(start, [90, 65, 65, 65, 90], 5))).toEqual([]);
    const severe = lowEvents(
      series(start, [90, 60, 50, 50, 50, 50, 60, 90], 5),
    );
    expect(severe).toHaveLength(1);
    expect(severe[0]).toMatchObject({ level: 2, minMgdl: 50 });
    // 30분 공백이 있으면 이어진 구간이 아니다
    const gap = [
      { t: start.getTime(), mgdl: 65 },
      { t: start.getTime() + 10 * MINUTE_MS, mgdl: 65 },
      { t: start.getTime() + 40 * MINUTE_MS, mgdl: 65 },
    ];
    expect(lowEvents(gap)).toEqual([]);
  });

  it("식후 반응: 기준값·최고값·상승폭·회복 시간", () => {
    const meal = new Date("2026-10-19T12:00:00+09:00").getTime();
    // 11:45부터 15분 간격
    const pts = series(
      new Date(meal - 15 * MINUTE_MS),
      [98, 100, 130, 165, 150, 125, 115, 105, 100],
    );
    const r = mealResponse(pts, meal)!;
    expect(r).toEqual({
      baseline: 100,
      peak: 165,
      rise: 65,
      minutesToPeak: 30,
      minutesToRecover: 75,
      band: "LARGE",
    });
    // 식사 전 기준값이 없으면 계산하지 않는다
    expect(mealResponse(pts.slice(3), meal)).toBeNull();
  });
});

describe("CGM 파일 읽기", () => {
  it("머리글 앞의 기기 정보 줄을 건너뛰고, 시각·혈당 열을 찾는다", () => {
    const csv = [
      "가상 기기,serial 0000",
      "Device,Device Timestamp,Record Type,Historic Glucose mg/dL,Glucose mmol/L",
      "X,2026-10-19 08:00,0,102,5.7",
      "X,2026-10-19 08:15,0,Low,",
      "X,2026-10-19 08:30,0,180,10",
      "X,2026-10-19 08:30,0,181,10",
      "X,잘못된 시각,0,120,6",
    ].join("\n");
    const r = parseCgmCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.readings.map((x) => x.mgdl)).toEqual([102, 181]);
    expect(r.skipped).toBe(2);
    expect(r.readings[0].measuredAt.toISOString()).toBe(
      "2026-10-18T23:00:00.000Z",
    );
  });

  it("시간대 표시가 없으면 한국 시간, Z·오프셋은 그대로", () => {
    expect(parseCgmTimestamp("2026/10/19 9:05")?.toISOString()).toBe(
      "2026-10-19T00:05:00.000Z",
    );
    expect(parseCgmTimestamp("2026-10-19T00:05:00Z")?.toISOString()).toBe(
      "2026-10-19T00:05:00.000Z",
    );
    expect(parseCgmTimestamp("2026-10-19T09:05:00+0900")?.toISOString()).toBe(
      "2026-10-19T00:05:00.000Z",
    );
    expect(parseCgmTimestamp("10/19/2026 09:05")).toBeNull();
  });

  it("머리글을 못 찾거나 값이 없으면 실패", () => {
    expect(parseCgmCsv("a,b\n1,2")).toEqual({ ok: false, reason: "no-header" });
    expect(parseCgmCsv("시간,혈당\n2026-10-19 08:00,700")).toEqual({
      ok: false,
      reason: "no-rows",
    });
  });
});

describe("부작용 체크인 안내 단계", () => {
  const scores = (patch: Partial<SymptomScores>): SymptomScores => ({
    ...emptySymptoms(),
    ...patch,
  });

  it("증상 없음 → NONE, 가벼운 증상 → SELF_CARE (점수 높은 순으로 대처 안내)", () => {
    expect(
      triageCheckIn({ symptoms: emptySymptoms(), redFlags: [] }).level,
    ).toBe("NONE");
    const t = triageCheckIn({
      symptoms: scores({ CONSTIPATION: 1, NAUSEA: 2 }),
      redFlags: [],
    });
    expect(t.level).toBe("SELF_CARE");
    expect(t.coping).toEqual(["NAUSEA", "CONSTIPATION"]);
  });

  it("심한 증상·보통 이상 구토 → CONTACT_CLINIC", () => {
    expect(
      triageCheckIn({ symptoms: scores({ FATIGUE: 3 }), redFlags: [] }).level,
    ).toBe("CONTACT_CLINIC");
    expect(
      triageCheckIn({ symptoms: scores({ VOMITING: 2 }), redFlags: [] }).level,
    ).toBe("CONTACT_CLINIC");
    expect(
      triageCheckIn({ symptoms: scores({ VOMITING: 1 }), redFlags: [] }).level,
    ).toBe("SELF_CARE");
  });

  it("위험 신호는 증상 점수와 관계없이 단계를 올린다", () => {
    expect(
      triageCheckIn({
        symptoms: emptySymptoms(),
        redFlags: ["LOW_GLUCOSE_SYMPTOMS"],
      }).level,
    ).toBe("CONTACT_CLINIC");
    expect(
      triageCheckIn({
        symptoms: scores({ NAUSEA: 1 }),
        redFlags: ["SEVERE_ABDOMINAL_PAIN", "DEHYDRATION_SIGNS"],
      }).level,
    ).toBe("URGENT");
  });
});

describe("위험 신호 (에스컬레이션)", () => {
  const base = {
    today: TODAY,
    checkIns: [],
    lowEvents: [],
    missed: { count: 0, alert: false, key: "2026-10-22" },
  };
  const day = (date: string, vomiting: 0 | 1 | 2 | 3) => ({
    date,
    triage: "SELF_CARE" as const,
    symptoms: { ...emptySymptoms(), VOMITING: vomiting },
  });

  it("아무 신호가 없으면 빈 목록", () => {
    expect(evaluateAlerts(base)).toEqual([]);
  });

  it("구토가 3일 연속이면 지속 구토 (하루 빠지면 다시 센다)", () => {
    const three = [
      day("2026-10-18", 1),
      day("2026-10-19", 1),
      day("2026-10-20", 1),
    ];
    expect(evaluateAlerts({ ...base, checkIns: three })).toEqual([
      {
        kind: "PERSISTENT_VOMITING",
        level: "CONTACT_CLINIC",
        dedupeKey: "2026-10-20",
      },
    ]);
    const broken = [
      day("2026-10-17", 1),
      day("2026-10-18", 1),
      day("2026-10-20", 1),
    ];
    expect(evaluateAlerts({ ...base, checkIns: broken })).toEqual([]);
  });

  it("의원 연락 단계 체크인, 저혈당 반복·심한 저혈당, 투약 누락", () => {
    const at = (date: string) => kstDateTime(date, "03:00").getTime();
    const alerts = evaluateAlerts({
      ...base,
      checkIns: [{ ...day("2026-10-19", 0), triage: "URGENT" }],
      lowEvents: [
        {
          start: at("2026-10-16"),
          end: at("2026-10-16") + 20 * MINUTE_MS,
          minMgdl: 62,
          level: 1,
        },
        {
          start: at("2026-10-19"),
          end: at("2026-10-19") + 20 * MINUTE_MS,
          minMgdl: 50,
          level: 2,
        },
        // 7일보다 오래된 구간은 세지 않는다
        {
          start: at("2026-10-01"),
          end: at("2026-10-01") + 20 * MINUTE_MS,
          minMgdl: 50,
          level: 2,
        },
      ],
      missed: { count: 2, alert: true, key: "2026-10-08" },
    });
    expect(alerts).toEqual([
      { kind: "SEVERE_SYMPTOM", level: "URGENT", dedupeKey: "2026-10-19" },
      {
        kind: "SEVERE_LOW_GLUCOSE",
        level: "CONTACT_CLINIC",
        dedupeKey: "2026-10-19",
      },
      { kind: "LOW_GLUCOSE", level: "CONTACT_CLINIC", dedupeKey: "2026-10-19" },
      {
        kind: "MISSED_DOSES",
        level: "CONTACT_CLINIC",
        dedupeKey: "2026-10-08",
      },
    ]);
  });
});

describe("약물 반응 타임라인", () => {
  const checkIn = (
    date: string,
    appetite: number,
    nausea: 0 | 1 | 2 | 3,
    weightKg: number | null = null,
  ) => ({
    date,
    appetite,
    symptoms: { ...emptySymptoms(), NAUSEA: nausea },
    weightKg,
  });

  it("투약 후 경과일별로 식욕·메스꺼움을 모은다 (다음 투약일부터는 다음 주기)", () => {
    const doses = [dose("2026-10-06"), dose("2026-10-13")];
    const rows = doseDayProfile(
      doses,
      {
        checkIns: [
          checkIn("2026-10-06", 3, 2),
          checkIn("2026-10-13", 5, 2),
          checkIn("2026-10-08", 6, 0),
          checkIn("2026-10-15", 8, 0),
        ],
        glucose: [],
        mealRises: [],
      },
      TODAY,
    );
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({
      offset: 0,
      appetite: { avg: 4, n: 2 },
      nausea: { avg: 2, n: 2 },
    });
    expect(rows[2]).toMatchObject({
      appetite: { avg: 7, n: 2 },
      nausea: { avg: 0, n: 2 },
    });
    expect(rows[1].appetite).toBeNull();
  });

  it("용량이 바뀐 날마다 구간을 나누고, 시작 전 혈당이 있으면 맨 앞에 둔다", () => {
    const doses = [
      dose("2026-09-22", "TAKEN", 2.5),
      dose("2026-09-29", "TAKEN", 2.5),
      dose("2026-10-06", "TAKEN", 5),
      dose("2026-10-13", "TAKEN", 5),
      dose("2026-10-20", "MISSED", 5),
    ];
    const glucose = [
      ...series(new Date("2026-09-20T00:00:00+09:00"), Array(96).fill(140)),
      ...series(new Date("2026-10-10T00:00:00+09:00"), Array(96).fill(110)),
    ];
    const periods = dosePeriods(
      doses,
      {
        checkIns: [
          checkIn("2026-09-22", 7, 1, 90),
          checkIn("2026-10-05", 5, 0, 88.4),
          checkIn("2026-10-06", 4, 2, 88),
          checkIn("2026-10-19", 4, 1, 86.5),
        ],
        glucose,
        mealRises: [],
      },
      "2026-09-22",
      TODAY,
    );
    expect(periods.map((p) => [p.doseMg, p.from, p.to])).toEqual([
      [null, "2026-09-08", "2026-09-21"],
      [2.5, "2026-09-22", "2026-10-05"],
      [5, "2026-10-06", TODAY],
    ]);
    expect(periods[0].glucose?.mean).toBe(140);
    expect(periods[2].glucose?.mean).toBe(110);
    expect(periods[1].weightChange).toBe(-1.6);
    expect(periods[2].nausea).toEqual({ avg: 1.5, n: 2 });
  });
});

describe("식사", () => {
  it("항목 합계 — 값이 하나도 없으면 null", () => {
    expect(
      mealTotals([
        { name: "현미밥", kcal: 300, carbsG: 65 },
        { name: "두부구이", kcal: 150, proteinG: 12 },
      ]),
    ).toEqual({ kcal: 450, carbsG: 65, proteinG: 12 });
    expect(mealTotals([{ name: "물" }])).toEqual({
      kcal: null,
      carbsG: null,
      proteinG: null,
    });
  });

  it("사진 추정값은 범위·개수·이름 길이를 정리한다", () => {
    const items = cleanMealPhotoRead({
      isFood: true,
      items: [
        { name: "  김치찌개 ", kcal: 250.4, carbsG: -3, proteinG: 15 },
        { name: "", kcal: 1, carbsG: 1, proteinG: 1 },
      ],
    });
    expect(items).toEqual([
      { name: "김치찌개", kcal: 250, carbsG: 0, proteinG: 15 },
    ]);
  });
});

describe("시간", () => {
  it("한국 날짜 경계", () => {
    expect(kstDate(new Date("2026-10-19T14:59:00Z"))).toBe("2026-10-19");
    expect(kstDate(new Date("2026-10-19T15:00:00Z"))).toBe("2026-10-20");
  });
});

describe("케어 문구 안전성", () => {
  const all = [
    careDisclaimer,
    escalationTip,
    escalationSupport,
    glucoseNote,
    `담당 의원${alertAction}`,
    missedDoseAction,
    ...Object.values(alertContent),
    ...Object.values(redFlagLabels),
    ...Object.values(copingTips).flat(),
    ...Object.values(triageContent).flatMap((t) => [t.title, t.body]),
    ...careConsentItems.flatMap((c) => [c.title, c.body]),
  ];

  it("진단·약 지시·진료 불필요 표현이 없다 (AI 안전 검사와 같은 기준)", () => {
    for (const text of all) {
      const sentences = text.split(/(?<=[.요다])\s+/);
      for (const s of sentences) expect(checkText(s), s).toEqual({ ok: true });
    }
  });

  it('질병명·확률 표현을 쓰지 않는다 ("진단이 아닙니다" 고지문 제외)', () => {
    const text = all.filter((t) => t !== careDisclaimer).join(" ");
    for (const banned of ["진단", "질환", "췌장염", "%의 확률", "위험률"])
      expect(text).not.toContain(banned);
  });
});
