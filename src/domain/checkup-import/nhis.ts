import { parseLooseDate, parseLooseNumber } from "./normalize";
import type { ImportableCode, RawCheckupData, RawCheckupItem } from "./types";

/**
 * 국민건강보험공단 일반건강검진 결과 → 공통 형식 변환기.
 *
 * 공단 결과표·공공데이터(건강검진정보)의 항목명을 기준으로 만들었다.
 * 실제 API 연동 시 응답 필드명이 다르면 NHIS_FIELD_ALIASES에 별칭만 추가하면 된다.
 * (연동 계약 전이므로 필드명은 확정되지 않았다 — docs/CHECKUP_IMPORT.md)
 */
export const NHIS_FIELD_ALIASES: Record<ImportableCode, string[]> = {
  HEIGHT: ["신장", "키", "height"],
  WEIGHT: ["체중", "몸무게", "weight"],
  WAIST: ["허리둘레", "waist"],
  SBP: ["수축기혈압", "최고혈압", "sbp"],
  DBP: ["이완기혈압", "최저혈압", "dbp"],
  FASTING_GLUCOSE: ["공복혈당", "식전혈당", "식전혈당(공복혈당)", "fbs"],
  HBA1C: ["당화혈색소", "hba1c"],
  TOTAL_CHOLESTEROL: ["총콜레스테롤", "totalcholesterol", "tc"],
  LDL: ["ldl콜레스테롤", "저밀도콜레스테롤", "ldl"],
  HDL: ["hdl콜레스테롤", "고밀도콜레스테롤", "hdl"],
  TRIGLYCERIDE: ["중성지방", "트리글리세라이드", "triglyceride", "tg"],
  AST: ["ast", "sgot", "혈청지오티", "혈청지오티(ast)", "ast(sgot)"],
  ALT: ["alt", "sgpt", "혈청지피티", "혈청지피티(alt)", "alt(sgpt)"],
  GGT: ["감마지티피", "γ-gtp", "감마지티피(γ-gtp)", "ggt", "gtp"],
  CREATININE: ["혈청크레아티닌", "크레아티닌", "creatinine"],
  EGFR: ["신사구체여과율", "사구체여과율", "e-gfr", "egfr"],
};

const DATE_KEYS = ["검진일자", "검진일", "수검일자", "checkupdate"];
/** "120/80" 형태로 함께 적힌 혈압 */
const BP_KEYS = ["혈압", "bloodpressure"];

/** 항목명 비교용: 소문자, 공백·밑줄·하이픈·괄호 제거 */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-()[\]]/g, "");
}

const LABEL_TO_METRIC = new Map<string, ImportableCode>();
for (const [metric, aliases] of Object.entries(NHIS_FIELD_ALIASES)) {
  for (const a of aliases)
    LABEL_TO_METRIC.set(normalizeLabel(a), metric as ImportableCode);
}

/**
 * 항목명 → 지표. 그대로 찾지 못하면 괄호 앞(예: "신사구체여과율")과
 * 괄호 안(예: "e-GFR")을 차례로 찾는다.
 */
export function metricForLabel(label: string): ImportableCode | undefined {
  const exact = LABEL_TO_METRIC.get(normalizeLabel(label));
  if (exact) return exact;
  const m = label.match(/^([^(]+)\(([^)]+)\)/);
  if (!m) return undefined;
  return (
    LABEL_TO_METRIC.get(normalizeLabel(m[1])) ??
    LABEL_TO_METRIC.get(normalizeLabel(m[2]))
  );
}

/** 값에 단위가 붙어 있으면 분리한다 (예: "98 mg/dL") */
function splitValueUnit(v: unknown): { value: number | null; unit?: string } {
  if (typeof v === "number") return { value: parseLooseNumber(v) };
  if (typeof v !== "string") return { value: null };
  const m = v.trim().match(/^(-?[\d,]+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { value: null };
  return { value: parseLooseNumber(m[1]), unit: m[2] || undefined };
}

/**
 * 공단 검진 결과 한 건(항목명 → 값)을 공통 형식으로 바꾼다.
 * 알 수 없는 항목(요단백, 혈색소 등 앱에서 쓰지 않는 항목)은 무시한다.
 */
export function fromNhisRecord(
  record: Record<string, unknown>,
): RawCheckupData {
  const items: RawCheckupItem[] = [];
  let checkupDate: string | null = null;

  for (const [key, raw] of Object.entries(record)) {
    const label = normalizeLabel(key);
    if (DATE_KEYS.includes(label)) {
      checkupDate = parseLooseDate(raw);
      continue;
    }
    if (BP_KEYS.includes(label) && typeof raw === "string") {
      const bp = raw.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})/);
      if (bp) {
        items.push({ metric: "SBP", value: Number(bp[1]), unit: "mmHg" });
        items.push({ metric: "DBP", value: Number(bp[2]), unit: "mmHg" });
      }
      continue;
    }
    const metric = metricForLabel(key);
    if (!metric) continue;
    const { value, unit } = splitValueUnit(raw);
    if (value !== null) items.push({ metric, value, unit });
  }
  return { checkupDate, items };
}
