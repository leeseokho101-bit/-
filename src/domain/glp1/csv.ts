/**
 * CGM 앱 내보내기 파일(CSV) 읽기.
 *
 * 머리글에서 시각 열과 혈당(mg/dL) 열을 찾는다. 제조사마다 열 이름이 달라 이름 일부로 찾는다.
 * - 시각: "timestamp", "time", "date", "시간", "일시", "시각"
 * - 혈당: "glucose", "혈당" (mmol/L 열은 쓰지 않는다)
 * 시각 형식: YYYY-MM-DD HH:mm(:ss), YYYY/MM/DD HH:mm, YYYY-MM-DDTHH:mm(:ss)[Z|±hh:mm]
 * 시간대 표시가 없으면 한국 시간으로 본다. "Low"/"High" 같은 글자 값과 범위 밖 값은 건너뛴다.
 */
export const CGM_MIN_MGDL = 20;
export const CGM_MAX_MGDL = 600;
export const CSV_MAX_ROWS = 50_000;

export type ParsedCgmCsv =
  | {
      ok: true;
      readings: { measuredAt: Date; mgdl: number }[];
      skipped: number;
    }
  | { ok: false; reason: "no-header" | "no-rows" | "too-many-rows" };

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const TIME_HINTS = ["timestamp", "time", "date", "시간", "일시", "시각"];
const GLUCOSE_HINTS = ["glucose", "혈당"];

function findColumns(
  cells: string[],
): { time: number; glucose: number } | null {
  const lower = cells.map((c) => c.toLowerCase());
  const glucose = lower.findIndex(
    (c) => GLUCOSE_HINTS.some((h) => c.includes(h)) && !c.includes("mmol"),
  );
  const time = lower.findIndex(
    (c, i) => i !== glucose && TIME_HINTS.some((h) => c.includes(h)),
  );
  return glucose >= 0 && time >= 0 ? { time, glucose } : null;
}

const DATE_RE =
  /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

export function parseCgmTimestamp(raw: string): Date | null {
  const m = DATE_RE.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00", tz] = m;
  const pad = (v: string) => v.padStart(2, "0");
  const zone = !tz
    ? "+09:00"
    : tz === "Z"
      ? "Z"
      : tz.replace(/(\d{2})(\d{2})$/, "$1:$2");
  const iso = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${mi}:${s}${zone}`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const date = new Date(t);
  // 2월 30일처럼 넘어가는 날짜는 거른다
  return Number(mo) <= 12 && Number(d) <= 31 ? date : null;
}

export function parseCgmCsv(text: string): ParsedCgmCsv {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  let cols: { time: number; glucose: number } | null = null;
  let sep = ",";
  let start = 0;
  // 앞쪽 몇 줄은 기기 정보일 수 있다 (머리글은 처음 20줄 안에서 찾는다)
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    sep = lines[i].includes("\t") && !lines[i].includes(",") ? "\t" : ",";
    cols = findColumns(splitLine(lines[i], sep));
    if (cols) {
      start = i + 1;
      break;
    }
  }
  if (!cols) return { ok: false, reason: "no-header" };
  const body = lines.slice(start).filter((l) => l.trim());
  if (body.length > CSV_MAX_ROWS) return { ok: false, reason: "too-many-rows" };

  const byTime = new Map<number, number>();
  let skipped = 0;
  for (const line of body) {
    const cells = splitLine(line, sep);
    const at = parseCgmTimestamp(cells[cols.time] ?? "");
    const value = Number((cells[cols.glucose] ?? "").replace(/,/g, ""));
    if (
      !at ||
      !(cells[cols.glucose] ?? "").trim() ||
      !Number.isFinite(value) ||
      value < CGM_MIN_MGDL ||
      value > CGM_MAX_MGDL
    ) {
      skipped++;
      continue;
    }
    // 같은 시각(분 단위)이 여러 줄이면 마지막 값
    const minute = Math.floor(at.getTime() / 60_000) * 60_000;
    byTime.set(minute, Math.round(value));
  }
  if (!byTime.size) return { ok: false, reason: "no-rows" };
  const readings = [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, mgdl]) => ({ measuredAt: new Date(t), mgdl }));
  return { ok: true, readings, skipped };
}
