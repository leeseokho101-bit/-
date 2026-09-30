/**
 * 국민건강보험공단 "한국인 ○○ 참조표준"(공공데이터포털 xlsx) → 생체나이 기준 곡선
 *
 * 표 한 줄 = 지역 × 성별 × 연령대(주로 2세 간격) 요약값: 측정값(평균)·측정 수·1~99 백분위수
 * (일부 표는 표준편차, 유병자/약복용자·고혈압약 복용자 포함·제외 구분이 있다).
 *
 * - 전국 행을 쓰고, 전국 행이 없는 표(허리둘레)는 시·도 행을 측정 수로 가중 평균한다.
 * - 포함/제외 구분이 있으면 "제외"(유병자·약복용자 제외 = 치료받지 않은 또래)를 쓴다.
 *   생체나이 엔진이 약 복용자의 "약을 먹지 않았다면" 수치를 추정해 비교하므로 기준도 미치료 집단이 맞다.
 * - 평균: NORMAL 지표는 측정값, LOG 지표(중성지방)는 중앙값(50분위수)
 * - 퍼짐: 사분위범위로 추정 — NORMAL (P75−P25)/1.349, LOG exp(ln(P75/P25)/1.349)
 * - eGFR: 크레아티닌 평균·표준편차를 연령대 중앙 나이의 CKD-EPI 2021로 변환
 * - 체질량지수 등 생체나이에 쓰지 않는 표는 건너뛴다.
 */
import { egfrFromCreatinine } from "@/domain/bio-age/engine";
import {
  references,
  type GeneratedCurve,
  type GeneratedReference,
  type ReferenceMetric,
} from "@/domain/bio-age/rules/reference";
import { METRICS } from "@/domain/health-snapshot/metrics";

type Sex = "MALE" | "FEMALE";
type SourceMetric = ReferenceMetric | "CREATININE";

export type StandardRecord = {
  metric: SourceMetric;
  region: string;
  sex: Sex;
  age: number;
  /** 유병자·약복용자 포함 여부 구분이 있는 표만 */
  variant: "INCLUDE" | "EXCLUDE" | null;
  mean: number;
  sd: number | null;
  n: number;
  /** 백분위수 (1, 5, 10, 25, 50, 75, 90, 95, 99) */
  pct: Record<number, number>;
};

/** 측정량 문구 → 지표 (먼저 맞는 규칙 사용) */
const METRIC_RULES: [RegExp, SourceMetric | null][] = [
  [/체질량지수|비만지수\(체질량/, null],
  [/수축기/, "SBP"],
  [/이완기/, "DBP"],
  [/중성지방|트리글리세라이드/, "TRIGLYCERIDE"],
  [/HDL/i, "HDL"],
  [/LDL/i, "LDL"],
  [/총콜레스테롤/, "TOTAL_CHOLESTEROL"],
  [/당화혈색소|HbA1c/i, "HBA1C"],
  [/혈색소|헤모글로빈/, "HEMOGLOBIN"],
  [/혈당/, "FASTING_GLUCOSE"],
  [/허리둘레/, "WAIST"],
  [/크레아티닌/, "CREATININE"],
  [/사구체|eGFR/i, "EGFR"],
  [/감마|GGT|GTP/i, "GGT"],
  [/AST|지오티/i, "AST"],
  [/ALT|지피티/i, "ALT"],
];

export function metricFromText(text: string): SourceMetric | null | undefined {
  const rule = METRIC_RULES.find(([re]) => re.test(text));
  return rule ? rule[1] : undefined;
}

/** "20~24 세" → 22.5, "25~26 세" → 26, "75 세 이상" → 77.5 */
export function ageMidpoint(label: string): number | null {
  const range = label.match(/(\d+)\s*~\s*(\d+)/);
  if (range) return (Number(range[1]) + Number(range[2]) + 1) / 2;
  const open = label.match(/(\d+)\s*세?\s*이상/);
  if (open) return Number(open[1]) + 2.5;
  return null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};

/** 표(첫 줄 = 머리글) → 레코드. 머리글 이름으로 열을 찾는다 */
export function parseStandardTable(
  title: string,
  table: unknown[][],
): StandardRecord[] {
  const header = (table[0] ?? []).map((h) =>
    String(h ?? "").replace(/\s/g, ""),
  );
  const col = (test: (h: string) => boolean) => header.findIndex(test);
  const iRegion = col((h) => h === "지역");
  const iSex = col((h) => h === "성별");
  const iAge = col((h) => h.startsWith("나이"));
  const iQty = col((h) => h === "측정량");
  const iMean = col((h) => h.startsWith("측정값"));
  const iSd = col((h) => h.startsWith("표준편차"));
  const iN = col((h) => h.startsWith("측정수"));
  const iVariant = col((h) => h.includes("포함여부"));
  const iSide = col((h) => h.includes("수축기/이완기"));
  const pctCols = header
    .map((h, i) => [h.match(/^(\d+)분위수/)?.[1], i] as const)
    .filter((x): x is [string, number] => x[0] !== undefined)
    .map(([p, i]) => [Number(p), i] as const);
  if ([iRegion, iSex, iAge, iMean, iN].some((i) => i < 0))
    throw new Error(
      `${title}: 참조표준 표 형식이 아닙니다 (지역·성별·나이·측정값·측정 수 열 필요)`,
    );

  const out: StandardRecord[] = [];
  for (const row of table.slice(1)) {
    const text = [
      iSide >= 0 ? row[iSide] : "",
      iQty >= 0 ? row[iQty] : "",
      title,
    ]
      .map((v) => String(v ?? ""))
      .join(" ");
    const metric = metricFromText(text);
    if (!metric) continue;
    const sexText = String(row[iSex] ?? "");
    const sex: Sex | null = sexText.startsWith("남")
      ? "MALE"
      : sexText.startsWith("여")
        ? "FEMALE"
        : null;
    const age = ageMidpoint(String(row[iAge] ?? ""));
    const mean = num(row[iMean]);
    const n = num(row[iN]);
    if (!sex || age === null || mean === null || n === null) continue;
    const variantText = `${iVariant >= 0 ? row[iVariant] : ""} ${iQty >= 0 ? row[iQty] : ""}`;
    const variant = /제외/.test(variantText)
      ? "EXCLUDE"
      : iVariant >= 0 || /포함\)/.test(variantText)
        ? "INCLUDE"
        : null;
    const pct: Record<number, number> = {};
    for (const [p, i] of pctCols) {
      const v = num(row[i]);
      if (v !== null) pct[p] = v;
    }
    out.push({
      metric,
      region: String(row[iRegion] ?? "").trim(),
      sex,
      age,
      variant,
      mean,
      sd: iSd >= 0 ? num(row[iSd]) : null,
      n,
      pct,
    });
  }
  return out;
}

/** 전국 행이 없으면 시·도 행을 측정 수로 가중 평균 */
function nationalRecords(records: StandardRecord[]): StandardRecord[] {
  const national = records.filter((r) => r.region === "전국");
  if (national.length) return national;
  const byAge = new Map<number, StandardRecord[]>();
  for (const r of records) byAge.set(r.age, [...(byAge.get(r.age) ?? []), r]);
  return [...byAge.values()].map((group) => {
    const n = group.reduce((s, r) => s + r.n, 0);
    const avg = (pick: (r: StandardRecord) => number | undefined | null) => {
      const valid = group.filter((r) => pick(r) != null);
      const w = valid.reduce((s, r) => s + r.n, 0);
      return w ? valid.reduce((s, r) => s + pick(r)! * r.n, 0) / w : null;
    };
    const pct: Record<number, number> = {};
    for (const p of Object.keys(group[0].pct).map(Number)) {
      const v = avg((r) => r.pct[p]);
      if (v !== null) pct[p] = v;
    }
    return {
      ...group[0],
      region: "전국(시·도 가중평균)",
      n,
      mean: avg((r) => r.mean)!,
      sd: avg((r) => r.sd),
      pct,
    };
  });
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function curveFor(
  metric: ReferenceMetric,
  records: StandardRecord[],
): GeneratedCurve | undefined {
  if (!records.length) return undefined;
  const log = references[metric].scale === "LOG";
  const decimals = METRICS[metric].decimals + 1;
  const sorted = [...records].sort((a, b) => a.age - b.age);
  const curve: GeneratedCurve = { ages: [], mean: [], spread: [], n: [] };
  for (const r of sorted) {
    const { 25: p25, 50: p50, 75: p75 } = r.pct;
    let mean: number;
    let spread: number | null;
    if (log) {
      mean = p50 ?? r.mean;
      spread =
        p25 && p75 && p75 > p25 ? Math.exp(Math.log(p75 / p25) / 1.349) : null;
    } else {
      mean = r.mean;
      spread =
        p25 !== undefined && p75 !== undefined && p75 > p25
          ? (p75 - p25) / 1.349
          : r.sd;
    }
    if (!spread || !(spread > 0)) continue;
    curve.ages.push(r.age);
    curve.mean.push(round(mean, decimals));
    curve.spread.push(round(spread, log ? 3 : 2));
    curve.n.push(r.n);
  }
  return curve.ages.length ? curve : undefined;
}

/** 크레아티닌 표 → eGFR 곡선 (연령대 중앙 나이로 CKD-EPI 2021 변환) */
function egfrCurve(
  records: StandardRecord[],
  sex: Sex,
): GeneratedCurve | undefined {
  const sorted = [...records].sort((a, b) => a.age - b.age);
  const curve: GeneratedCurve = { ages: [], mean: [], spread: [], n: [] };
  for (const r of sorted) {
    const sd =
      r.sd ??
      (r.pct[25] !== undefined && r.pct[75] !== undefined
        ? (r.pct[75] - r.pct[25]) / 1.349
        : null);
    if (!sd) continue;
    const e = (cr: number) => egfrFromCreatinine(cr, sex, r.age);
    curve.ages.push(r.age);
    curve.mean.push(round(e(r.mean), 1));
    curve.spread.push(
      round((e(Math.max(0.1, r.mean - sd)) - e(r.mean + sd)) / 2, 2),
    );
    curve.n.push(r.n);
  }
  return curve.ages.length ? curve : undefined;
}

export function summarizeStandards(
  records: StandardRecord[],
  source: string,
): GeneratedReference {
  const metrics: GeneratedReference["metrics"] = {};
  const metricsIn = [...new Set(records.map((r) => r.metric))];
  for (const metric of metricsIn) {
    for (const sex of ["MALE", "FEMALE"] as const) {
      let rs = records.filter((r) => r.metric === metric && r.sex === sex);
      if (rs.some((r) => r.variant === "EXCLUDE"))
        rs = rs.filter((r) => r.variant === "EXCLUDE");
      rs = nationalRecords(rs);
      const target: ReferenceMetric = metric === "CREATININE" ? "EGFR" : metric;
      const curve =
        metric === "CREATININE" ? egfrCurve(rs, sex) : curveFor(metric, rs);
      if (curve) (metrics[target] ??= {})[sex] = curve;
    }
  }
  return { source, years: [], rows: 0, metrics };
}
