import { isWithinInputRange, METRICS } from "@/domain/health-snapshot/metrics";
import {
  IMPORTABLE_CODES,
  type ImportableCode,
  type ImportWarning,
  type NormalizedCheckup,
  type RawCheckupData,
} from "./types";
import { toCanonicalUnit } from "./units";

const importable = new Set<string>(IMPORTABLE_CODES);

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** YYYY-MM-DD 이고, 실제 있는 날짜이며, 1990년 이후·오늘 이전이어야 한다 */
export function validCheckupDate(
  value: string | null | undefined,
  today: Date,
): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    return undefined;
  const todayIso = today.toISOString().slice(0, 10);
  if (value > todayIso || value < "1990-01-01") return undefined;
  return value;
}

/**
 * 출처와 관계없이 가져온 검진 데이터를 같은 기준으로 정리한다.
 * - 알 수 없는 단위·허용 범위 밖 값은 버리고 경고로 남긴다 (잘못 읽은 값이 저장되지 않도록)
 * - 기준 단위로 변환하고 항목별 소수점 자릿수로 반올림한다
 * - 판정은 하지 않는다 (판정은 분석 엔진만 담당)
 */
export function normalizeCheckup(
  raw: RawCheckupData,
  today: Date = new Date(),
): NormalizedCheckup {
  const values: Partial<Record<ImportableCode, number>> = {};
  const warnings: ImportWarning[] = [];

  for (const item of raw.items) {
    const metric = item.metric;
    if (!importable.has(metric) || !Number.isFinite(item.value)) continue;
    if (values[metric] !== undefined) {
      warnings.push({ kind: "duplicate", metric });
      continue;
    }
    const unit = toCanonicalUnit(metric, item.value, item.unit);
    if (!unit.ok) {
      warnings.push({ kind: "unknown-unit", metric });
      continue;
    }
    const value = round(unit.value, METRICS[metric].decimals);
    if (!isWithinInputRange(metric, value)) {
      warnings.push({ kind: "out-of-range", metric });
      continue;
    }
    if (unit.converted) warnings.push({ kind: "unit-converted", metric });
    values[metric] = value;
  }

  if (
    values.SBP !== undefined &&
    values.DBP !== undefined &&
    values.SBP <= values.DBP
  ) {
    delete values.SBP;
    delete values.DBP;
    warnings.push({ kind: "bp-order", metric: "SBP" });
  }

  const checkupDate = validCheckupDate(raw.checkupDate, today);
  if (raw.checkupDate && !checkupDate) warnings.push({ kind: "invalid-date" });

  return { ...(checkupDate ? { checkupDate } : {}), values, warnings };
}

/** 여러 날짜 표기(2024.03.15, 20240315, 2024-3-5, 2024년 3월 5일)를 YYYY-MM-DD로 */
export function parseLooseDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const s = String(value).trim();
  const m =
    s.match(/^(\d{4})(\d{2})(\d{2})$/) ??
    s.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** "1,234.5", " 120 " 같은 표기를 숫자로. 숫자가 아니면 null */
export function parseLooseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const s = value.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
