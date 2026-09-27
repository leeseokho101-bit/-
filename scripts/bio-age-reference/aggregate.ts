/**
 * 국민건강보험공단 건강검진정보(표본 CSV) → 생체나이 기준 곡선
 *
 * - 행 = 수검자 1명. 성별코드(1 남, 2 여)·연령대코드(5세 단위: 5=20~24세 … 18=85세 이상)와 검사 수치를 쓴다.
 * - 입력 허용 범위(METRICS.inputRange) 밖의 값은 오타·결측 코드로 보고 제외하고,
 *   성별·연령대마다 양 끝 0.5%를 잘라낸 뒤 평균·표준편차(로그 척도 지표는 기하평균·기하표준편차)를 구한다.
 * - eGFR은 원자료에 없어 크레아티닌·연령대 중앙 나이로 CKD-EPI 2021을 계산해 쓴다.
 * - 당화혈색소는 일반건강검진 항목이 아니어서 만들지 않는다 (초안 값 유지).
 */
import { egfrFromCreatinine } from "@/domain/bio-age/engine";
import {
  references,
  type GeneratedCurve,
  type GeneratedReference,
  type ReferenceMetric,
} from "@/domain/bio-age/rules/reference";
import { isWithinInputRange, METRICS } from "@/domain/health-snapshot/metrics";

type Sex = "MALE" | "FEMALE";

/** 원자료 열 → 지표. 열 이름은 연도마다 조금씩 달라 핵심 단어로 찾는다 (공백·대소문자 무시) */
const COLUMN_RULES: { key: ColumnKey; match: (h: string) => boolean }[] = [
  { key: "year", match: (h) => h.includes("기준년도") },
  { key: "sex", match: (h) => h.includes("성별") },
  { key: "ageCode", match: (h) => h.includes("연령대") },
  { key: "WAIST", match: (h) => h.includes("허리둘레") },
  { key: "SBP", match: (h) => h.includes("수축기") },
  { key: "DBP", match: (h) => h.includes("이완기") },
  {
    key: "FASTING_GLUCOSE",
    match: (h) => h.includes("식전혈당") || h.includes("공복혈당"),
  },
  { key: "TOTAL_CHOLESTEROL", match: (h) => h.includes("총콜레스테롤") },
  {
    key: "TRIGLYCERIDE",
    match: (h) => h.includes("트리글리세라이드") || h.includes("중성지방"),
  },
  { key: "HDL", match: (h) => h.includes("hdl") },
  { key: "LDL", match: (h) => h.includes("ldl") },
  { key: "HEMOGLOBIN", match: (h) => h.includes("혈색소") },
  { key: "CREATININE", match: (h) => h.includes("크레아티닌") },
  { key: "GGT", match: (h) => h.includes("감마") || h.includes("gtp") },
  { key: "AST", match: (h) => h.includes("ast") || h.includes("지오티") },
  { key: "ALT", match: (h) => h.includes("alt") || h.includes("지피티") },
];

type SourceMetric = Exclude<ReferenceMetric, "HBA1C" | "EGFR"> | "CREATININE";
type ColumnKey = "year" | "sex" | "ageCode" | SourceMetric;

/** 원자료로 만드는 지표 (당화혈색소 제외) */
export const GENERATED_METRICS: ReferenceMetric[] = [
  "WAIST",
  "SBP",
  "DBP",
  "FASTING_GLUCOSE",
  "TOTAL_CHOLESTEROL",
  "TRIGLYCERIDE",
  "HDL",
  "LDL",
  "HEMOGLOBIN",
  "EGFR",
  "AST",
  "ALT",
  "GGT",
];

const REQUIRED: ColumnKey[] = ["sex", "ageCode"];
const REQUIRED_LABELS: Partial<Record<ColumnKey, string>> = {
  sex: "성별코드",
  ageCode: "연령대코드",
};

export type ColumnMap = Partial<Record<ColumnKey, number>>;

const normalize = (h: string) =>
  h.replace(/^﻿/, "").replace(/["\s]/g, "").toLowerCase();

/** 헤더 → 열 번호. 필수 열(성별·연령대)이 없으면 오류 */
export function mapColumns(header: string[]): {
  columns: ColumnMap;
  missing: ColumnKey[];
} {
  const columns: ColumnMap = {};
  header.map(normalize).forEach((h, i) => {
    const rule = COLUMN_RULES.find(
      (r) => columns[r.key] === undefined && r.match(h),
    );
    if (rule) columns[rule.key] = i;
  });
  const missing = REQUIRED.filter((k) => columns[k] === undefined);
  if (missing.length)
    throw new Error(
      `필수 열(${missing.map((k) => REQUIRED_LABELS[k]).join(", ")})을 찾지 못했습니다. 공단 건강검진정보 CSV가 맞는지 확인해 주세요.`,
    );
  return {
    columns,
    missing: COLUMN_RULES.map((r) => r.key).filter(
      (k) => columns[k] === undefined,
    ),
  };
}

/** 연령대코드(5세 단위) → 중앙 나이. 20세 미만·알 수 없는 코드는 null */
export function ageFromCode(code: number): number | null {
  if (!Number.isInteger(code) || code < 5 || code > 18) return null;
  return code === 18 ? 87.5 : (code - 1) * 5 + 2.5;
}

/** UTF-8 BOM이 있거나 UTF-8로 올바르게 읽히면 UTF-8, 아니면 EUC-KR(공단 CSV 기본) */
export function detectEncoding(head: Uint8Array): "utf-8" | "euc-kr" {
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return "utf-8";
  try {
    // 청크 끝에서 글자가 잘렸을 수 있어 끝 몇 바이트는 빼고 검사한다
    new TextDecoder("utf-8", { fatal: true }).decode(
      head.subarray(0, Math.max(0, Math.min(head.length, 4000) - 3)),
    );
    return "utf-8";
  } catch {
    return "euc-kr";
  }
}

export function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
}

export class ReferenceAccumulator {
  private columns: ColumnMap = {};
  private readonly values = new Map<string, number[]>();
  private readonly years = new Set<number>();
  rows = 0;
  skipped = 0;

  /** 파일마다 열 순서가 다를 수 있어 파일 첫 줄마다 호출한다. 없는 열 목록을 돌려준다 */
  setHeader(header: string[]): ColumnKey[] {
    const { columns, missing } = mapColumns(header);
    this.columns = columns;
    return missing;
  }

  private push(metric: ReferenceMetric, sex: Sex, ageCode: number, v: number) {
    const k = `${metric}|${sex}|${ageCode}`;
    const list = this.values.get(k);
    if (list) list.push(v);
    else this.values.set(k, [v]);
  }

  add(cells: string[]) {
    const num = (key: ColumnKey) => {
      const i = this.columns[key];
      if (i === undefined) return undefined;
      const raw = cells[i];
      if (raw === undefined || raw === "") return undefined;
      const v = Number(raw);
      return Number.isFinite(v) ? v : undefined;
    };
    const sexCode = num("sex");
    const ageCode = num("ageCode");
    const sex: Sex | null =
      sexCode === 1 ? "MALE" : sexCode === 2 ? "FEMALE" : null;
    const age = ageCode === undefined ? null : ageFromCode(ageCode);
    if (!sex || age === null || ageCode === undefined) {
      this.skipped++;
      return;
    }
    this.rows++;
    const year = num("year");
    if (year) this.years.add(year);

    for (const metric of GENERATED_METRICS) {
      if (metric === "EGFR") continue;
      const v = num(metric as ColumnKey);
      if (v !== undefined && isWithinInputRange(metric, v))
        this.push(metric, sex, ageCode, v);
    }
    const cr = num("CREATININE");
    if (cr !== undefined && isWithinInputRange("CREATININE", cr)) {
      const egfr = egfrFromCreatinine(cr, sex, age);
      if (isWithinInputRange("EGFR", egfr))
        this.push("EGFR", sex, ageCode, egfr);
    }
  }

  summarize(opts: {
    source: string;
    minPerGroup?: number;
    trim?: number;
  }): GeneratedReference {
    const minPerGroup = opts.minPerGroup ?? 100;
    const trim = opts.trim ?? 0.005;
    const metrics: GeneratedReference["metrics"] = {};
    for (const metric of GENERATED_METRICS) {
      const log = references[metric].scale === "LOG";
      const decimals = METRICS[metric].decimals + 1;
      for (const sex of ["MALE", "FEMALE"] as const) {
        const curve: GeneratedCurve = { ages: [], mean: [], spread: [], n: [] };
        for (let code = 5; code <= 18; code++) {
          const raw = this.values.get(`${metric}|${sex}|${code}`);
          if (!raw || raw.length < minPerGroup) continue;
          const sorted = raw
            .map((v) => (log ? Math.log(v) : v))
            .sort((a, b) => a - b);
          const cut = Math.floor(sorted.length * trim);
          const kept = sorted.slice(cut, sorted.length - cut);
          const mean = kept.reduce((s, v) => s + v, 0) / kept.length;
          const sd = Math.sqrt(
            kept.reduce((s, v) => s + (v - mean) ** 2, 0) / (kept.length - 1),
          );
          curve.ages.push(ageFromCode(code)!);
          curve.mean.push(round(log ? Math.exp(mean) : mean, decimals));
          curve.spread.push(round(log ? Math.exp(sd) : sd, log ? 3 : 2));
          curve.n.push(raw.length);
        }
        if (curve.ages.length) (metrics[metric] ??= {})[sex] = curve;
      }
    }
    return {
      source: opts.source,
      years: [...this.years].sort((a, b) => a - b),
      rows: this.rows,
      metrics,
    };
  }
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** 생성 파일 내용 (prettier로 한 번 더 정리한다) */
export function renderGeneratedFile(ref: GeneratedReference): string {
  return `/**
 * 자동 생성 파일 — 직접 수정하지 않는다.
 * 국민건강보험공단 건강검진정보 원자료(CSV)로 만든다: \`npm run bioage:reference -- <CSV 경로>\`
 * 원자료: ${ref.source} · 기준년도 ${ref.years.join(", ") || "-"} · 수검자 ${ref.rows.toLocaleString("en-US")}명
 */
import type { GeneratedReference } from "./reference";

export const NHIS_REFERENCE: GeneratedReference | null = ${JSON.stringify(ref, null, 2)};
`;
}
