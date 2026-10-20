/**
 * 제약사 포털 집계 (순수 함수). 계획서 3-5 "채널 현황", "지속 복용 분석"과 8장 리베이트·개인정보 대응.
 *
 * 원칙
 * - "제약사 통계 제공"에 동의한 환자만 넣는다 (호출하는 쪽에서 거른다).
 * - 개별 의원 단위 숫자는 만들지 않는다. 지역 단위로만, 의원이 3곳 미만인 지역은 "그 밖의 지역"으로 합친다.
 * - 작은 숫자는 가린다: 5 미만 칸은 "5 미만", 분석 대상이 10명 미만이면 결과를 내지 않는다.
 *   합계가 보이는 표에서 가려진 칸이 하나뿐이면 빼기로 알아낼 수 있어 다른 칸도 함께 가린다(2차 가리기).
 */
import { addDaysIso, daysBetween } from "@/domain/glp1/time";
import { REGIONS } from "./regions";

export const MIN_CELL = 5;
export const MIN_COHORT = 10;
export const MIN_CLINICS_PER_REGION = 3;

/** 표시용 숫자: 5 미만이면 null (화면에 "5 미만") */
export type Count = number | null;
export const suppress = (n: number): Count => (n < MIN_CELL ? null : n);

/**
 * 작은 칸 가리기 + 2차 가리기: 가려진 칸(0 제외)이 하나뿐이면
 * 가려지지 않은 칸 중 가장 작은 칸(0 제외)도 함께 가린다.
 */
export function suppressColumn(raw: number[]): Count[] {
  const out = raw.map(suppress);
  const hidden = out.filter((v, i) => v === null && raw[i] > 0).length;
  if (hidden === 1) {
    let pick = -1;
    out.forEach((v, i) => {
      if (v !== null && raw[i] > 0 && (pick < 0 || raw[i] < raw[pick]))
        pick = i;
    });
    if (pick >= 0) out[pick] = null;
  }
  return out;
}

/** 비율은 분모가 MIN_COHORT 이상일 때만 */
export const rate = (num: number, den: number): number | null =>
  den >= MIN_COHORT ? Math.round((num / den) * 1000) / 10 : null;

// ─── 채널 현황 ───

export type ClinicInput = { region: string | null; createdOn: string };
export type PatientInput = {
  region: string | null;
  enrolledOn: string;
  /** 최근 활동(투약·체크인·식사 기록) 날짜 */
  lastActivity: string | null;
  stopped: boolean;
};

export const ACTIVE_DAYS = 30;
export const OTHER_REGION = "그 밖의 지역";

export type RegionRow = {
  region: string;
  clinics: number;
  /** 활성 환자가 있는 의원 수 (의원 이름·개별 숫자는 보여주지 않는다) */
  activeClinics: Count;
  activePatients: Count;
};

const isActive = (p: PatientInput, today: string) =>
  !p.stopped &&
  !!p.lastActivity &&
  daysBetween(p.lastActivity, today) < ACTIVE_DAYS;

export function channelByRegion(
  clinics: (ClinicInput & { id: string })[],
  patients: (PatientInput & { clinicId: string })[],
  today: string,
): RegionRow[] {
  const regionOf = (r: string | null) => r ?? "미지정";
  const counts = new Map<string, number>();
  for (const c of clinics)
    counts.set(regionOf(c.region), (counts.get(regionOf(c.region)) ?? 0) + 1);
  // 의원이 3곳 미만인 지역은 합친다 (한 의원의 숫자를 거꾸로 알 수 없게)
  const bucket = (r: string | null) =>
    (counts.get(regionOf(r)) ?? 0) >= MIN_CLINICS_PER_REGION
      ? regionOf(r)
      : OTHER_REGION;
  const clinicBucket = new Map(clinics.map((c) => [c.id, bucket(c.region)]));
  const rows = new Map<
    string,
    { clinics: number; active: Set<string>; patients: number }
  >();
  const row = (k: string) => {
    if (!rows.has(k))
      rows.set(k, { clinics: 0, active: new Set(), patients: 0 });
    return rows.get(k)!;
  };
  for (const c of clinics) row(clinicBucket.get(c.id)!).clinics++;
  for (const p of patients) {
    if (!isActive(p, today)) continue;
    const k = clinicBucket.get(p.clinicId);
    if (!k) continue;
    row(k).patients++;
    row(k).active.add(p.clinicId);
  }
  const order = [...REGIONS, "미지정", OTHER_REGION];
  const sorted = [...rows.entries()].sort(
    ([a], [b]) => order.indexOf(a) - order.indexOf(b),
  );
  const activeClinics = suppressColumn(sorted.map(([, r]) => r.active.size));
  const activePatients = suppressColumn(sorted.map(([, r]) => r.patients));
  return sorted.map(([region, r], i) => ({
    region,
    clinics: r.clinics,
    activeClinics: activeClinics[i],
    activePatients: activePatients[i],
  }));
}

export function channelTotals(
  clinics: ClinicInput[],
  patients: PatientInput[],
  today: string,
) {
  return {
    clinics: clinics.length,
    activePatients: suppress(patients.filter((p) => isActive(p, today)).length),
    enrolledPatients: suppress(patients.length),
  };
}

/** 최근 n개월 신규 등록 (월 단위, 한국 날짜 기준) */
export function monthlyEnrollments(
  patients: PatientInput[],
  today: string,
  months = 6,
): { month: string; count: Count }[] {
  const keys: string[] = [];
  const [y, m] = today.split("-").map(Number);
  for (let i = months - 1; i >= 0; i--)
    keys.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  const counts = suppressColumn(
    keys.map(
      (key) => patients.filter((p) => p.enrolledOn.startsWith(key)).length,
    ),
  );
  return keys.map((month, i) => ({ month, count: counts[i] }));
}

// ─── 지속 복용 ───

export type StopReason =
  | "SIDE_EFFECTS"
  | "COST"
  | "GOAL_REACHED"
  | "DOCTOR_ADVICE"
  | "INCONVENIENCE"
  | "OTHER";

export type CourseInput = {
  drugCode: string;
  intervalDays: 1 | 7;
  doseSteps: readonly number[];
  /** 투약함 기록 (날짜순) */
  taken: { date: string; doseMg: number }[];
  /** 환자가 기록한 중단 */
  stopped: { date: string; reason: StopReason | null } | null;
  /** 위장관 증상 "보통 이상"인 날 */
  giModerateDates: string[];
  /** 위험 신호가 생긴 날 */
  alertDates: string[];
};

/** 기록 없이 이만큼 지나면 중단으로 본다 (주 1회 약 3주, 매일 쓰는 약 1주) */
export const GAP_DAYS: Record<1 | 7, number> = { 7: 21, 1: 7 };
/** 증량 직후 이탈로 보는 기간 */
export const EARLY_AFTER_ESCALATION_WEEKS = 4;

export type Course = {
  drugCode: string;
  status: "ONGOING" | "STOPPED";
  /** 환자가 직접 기록했는지, 기록 공백으로 추정했는지 */
  inferred: boolean;
  reason: StopReason | null;
  /** 첫 투약부터 중단(또는 오늘)까지 주 */
  weeks: number;
  stepAtEnd: number | null;
  weeksOnLastDose: number;
  escalated: boolean;
  /** 중단 전 2주 안에 보인 신호 */
  preStop: { gi: boolean; alert: boolean };
};

/** 투약 기록이 하나도 없으면 분석에서 뺀다 (null) */
export function toCourse(c: CourseInput, today: string): Course | null {
  if (!c.taken.length) return null;
  const first = c.taken[0].date;
  const last = c.taken[c.taken.length - 1];
  let status: Course["status"] = "ONGOING";
  let end = today;
  let inferred = false;
  if (c.stopped) {
    status = "STOPPED";
    end = c.stopped.date < last.date ? last.date : c.stopped.date;
  } else if (daysBetween(last.date, today) > GAP_DAYS[c.intervalDays]) {
    status = "STOPPED";
    inferred = true;
    end = addDaysIso(last.date, c.intervalDays);
  }
  // 마지막 용량을 처음 쓴 날 (뒤에서부터 같은 용량이 이어진 구간의 시작)
  const lastDoseStart =
    [...c.taken]
      .reverse()
      .find((_, i, arr) => arr[i + 1]?.doseMg !== last.doseMg)?.date ?? first;
  const step = c.doseSteps.indexOf(last.doseMg);
  const within = (dates: string[]) =>
    dates.some((d) => d <= end && d > addDaysIso(end, -14));
  return {
    drugCode: c.drugCode,
    status,
    inferred,
    reason: c.stopped?.reason ?? null,
    weeks: Math.max(0, Math.floor(daysBetween(first, end) / 7)),
    stepAtEnd: step >= 0 ? step + 1 : null,
    weeksOnLastDose: Math.max(
      0,
      Math.floor(daysBetween(lastDoseStart, end) / 7),
    ),
    escalated: c.taken.some((t) => t.doseMg > c.taken[0].doseMg),
    preStop: { gi: within(c.giModerateDates), alert: within(c.alertDates) },
  };
}

export type CurvePoint = { week: number; persisting: number; atRisk: number };

/**
 * 지속 복용 곡선 (Kaplan–Meier). 중단 = 사건, 아직 진행 중 = 그 주에서 중도절단.
 * persisting은 %(소수 1자리). 위험집단이 MIN_COHORT 미만이 되는 주부터는 내지 않는다.
 */
export function persistenceCurve(
  courses: Course[],
  weeks = 12,
): CurvePoint[] | null {
  if (courses.length < MIN_COHORT) return null;
  let s = 1;
  const out: CurvePoint[] = [
    { week: 0, persisting: 100, atRisk: courses.length },
  ];
  for (let w = 1; w <= weeks; w++) {
    const atRisk = courses.filter((c) => c.weeks >= w - 1).length;
    const events = courses.filter(
      (c) => c.status === "STOPPED" && c.weeks === w - 1,
    ).length;
    if (atRisk < MIN_COHORT) break;
    s *= 1 - events / atRisk;
    out.push({ week: w, persisting: Math.round(s * 1000) / 10, atRisk });
  }
  return out;
}

export type DropoutSummary = {
  cohort: number;
  stopped: Count;
  /** 용량 단계별 이탈 (단계 번호, 이탈 수, 그 용량 유지 주 중앙값) */
  byStep: {
    step: number | null;
    count: Count;
    medianWeeksOnDose: number | null;
  }[];
  /** 증량 후 4주 안에 이탈한 비율 (증량 후 이탈 중) */
  earlyAfterEscalation: number | null;
  reasons: { reason: StopReason | "UNRECORDED"; count: Count }[];
  preStop: { gi: number | null; alert: number | null };
};

const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const REASON_KEYS: (StopReason | "UNRECORDED")[] = [
  "SIDE_EFFECTS",
  "COST",
  "INCONVENIENCE",
  "GOAL_REACHED",
  "DOCTOR_ADVICE",
  "OTHER",
  "UNRECORDED",
];

export function dropoutSummary(courses: Course[]): DropoutSummary | null {
  if (courses.length < MIN_COHORT) return null;
  const stopped = courses.filter((c) => c.status === "STOPPED");
  const steps = [...new Set(stopped.map((c) => c.stepAtEnd))].sort(
    (a, b) => (a ?? 99) - (b ?? 99),
  );
  const escalatedStops = stopped.filter((c) => c.escalated);
  const stepCounts = suppressColumn(
    steps.map((step) => stopped.filter((c) => c.stepAtEnd === step).length),
  );
  const reasonCounts = suppressColumn(
    REASON_KEYS.map(
      (reason) =>
        stopped.filter((c) =>
          reason === "UNRECORDED" ? c.reason === null : c.reason === reason,
        ).length,
    ),
  );
  return {
    cohort: courses.length,
    stopped: suppress(stopped.length),
    byStep: steps.map((step, i) => ({
      step,
      count: stepCounts[i],
      medianWeeksOnDose:
        stepCounts[i] !== null
          ? median(
              stopped
                .filter((c) => c.stepAtEnd === step)
                .map((c) => c.weeksOnLastDose),
            )
          : null,
    })),
    earlyAfterEscalation: rate(
      escalatedStops.filter(
        (c) => c.weeksOnLastDose < EARLY_AFTER_ESCALATION_WEEKS,
      ).length,
      escalatedStops.length,
    ),
    reasons: REASON_KEYS.map((reason, i) => ({
      reason,
      count: reasonCounts[i],
    })),
    preStop: {
      gi: rate(stopped.filter((c) => c.preStop.gi).length, stopped.length),
      alert: rate(
        stopped.filter((c) => c.preStop.alert).length,
        stopped.length,
      ),
    },
  };
}
