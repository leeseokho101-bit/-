import type { ImportableCode } from "./types";

/**
 * 단위 표기 정규화: 소문자·공백 제거, 한글 조합 문자(㎎, ㎗ 등)를 풀어 쓴다.
 * 예) "㎎/㎗" → "mg/dl", "mmHg" → "mmhg", "mL/min/1.73㎡" → "ml/min/1.73m2"
 */
export function normalizeUnit(unit: string): string {
  return unit
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/²/g, "2")
    .replace(/μ|µ/g, "u");
}

type Conversion = { units: string[]; factor: (v: number) => number };

const MG_DL = ["mg/dl"];
const MMOL_L = ["mmol/l"];

/** 항목별 앱 기준 단위(canonical)와 변환 가능한 단위 */
const UNIT_TABLE: Record<
  ImportableCode,
  { canonical: string[]; convert?: Conversion[] }
> = {
  HEIGHT: {
    canonical: ["cm"],
    convert: [{ units: ["m"], factor: (v) => v * 100 }],
  },
  WEIGHT: { canonical: ["kg"] },
  WAIST: {
    canonical: ["cm"],
    // 인치로 표시된 경우 (예: 허리둘레 34인치)
    convert: [{ units: ["inch", "in", "인치"], factor: (v) => v * 2.54 }],
  },
  // mm[hg]: FHIR·HL7에서 쓰는 UCUM 표기
  SBP: { canonical: ["mmhg", "mm[hg]"] },
  DBP: { canonical: ["mmhg", "mm[hg]"] },
  FASTING_GLUCOSE: {
    canonical: MG_DL,
    convert: [{ units: MMOL_L, factor: (v) => v * 18.016 }],
  },
  HBA1C: {
    canonical: ["%"],
    // IFCC(mmol/mol) → NGSP(%)
    convert: [{ units: ["mmol/mol"], factor: (v) => v / 10.929 + 2.15 }],
  },
  TOTAL_CHOLESTEROL: {
    canonical: MG_DL,
    convert: [{ units: MMOL_L, factor: (v) => v * 38.67 }],
  },
  LDL: {
    canonical: MG_DL,
    convert: [{ units: MMOL_L, factor: (v) => v * 38.67 }],
  },
  HDL: {
    canonical: MG_DL,
    convert: [{ units: MMOL_L, factor: (v) => v * 38.67 }],
  },
  TRIGLYCERIDE: {
    canonical: MG_DL,
    convert: [{ units: MMOL_L, factor: (v) => v * 88.57 }],
  },
  AST: { canonical: ["u/l", "iu/l", "[iu]/l"] },
  ALT: { canonical: ["u/l", "iu/l", "[iu]/l"] },
  GGT: { canonical: ["u/l", "iu/l", "[iu]/l"] },
  CREATININE: {
    canonical: MG_DL,
    convert: [{ units: ["umol/l"], factor: (v) => v / 88.42 }],
  },
  HEMOGLOBIN: {
    canonical: ["g/dl"],
    convert: [{ units: ["g/l"], factor: (v) => v / 10 }],
  },
  EGFR: { canonical: ["ml/min/1.73m2", "ml/min", "ml/min/{1.73_m2}"] },
};

export type UnitResult =
  { ok: true; value: number; converted: boolean } | { ok: false };

/**
 * 값을 앱 기준 단위로 맞춘다.
 * 단위가 비어 있으면 기준 단위로 보고(국내 검진 결과표는 기준 단위를 쓴다),
 * 알 수 없는 단위면 잘못 저장하지 않도록 거절한다.
 */
export function toCanonicalUnit(
  metric: ImportableCode,
  value: number,
  unit: string | null | undefined,
): UnitResult {
  const entry = UNIT_TABLE[metric];
  const u = unit ? normalizeUnit(unit) : "";
  if (!u || entry.canonical.includes(u))
    return { ok: true, value, converted: false };
  const conv = entry.convert?.find((c) => c.units.includes(u));
  if (!conv) return { ok: false };
  return { ok: true, value: conv.factor(value), converted: true };
}
