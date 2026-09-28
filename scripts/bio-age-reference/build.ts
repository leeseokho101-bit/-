/**
 * 사용법
 *  - 원자료:   npm run bioage:reference -- <건강검진정보.csv> [더 많은 CSV…] [--encoding euc-kr|utf-8] [--min-n 100]
 *  - 참조표준: npm run bioage:reference -- <한국인_○○_참조표준.xlsx> [더 많은 xlsx…] [--year 2021]
 *
 * 공공데이터포털 "국민건강보험공단_건강검진정보" CSV(보통 EUC-KR) 또는
 * "국민건강보험공단_한국인 ○○ 참조표준" xlsx를 읽어
 * src/domain/bio-age/rules/nhis-reference.generated.ts 를 다시 만든다.
 * 원자료는 저장소에 커밋하지 않는다 (용량이 크고, 생성 파일만 있으면 된다).
 */
import { spawnSync } from "node:child_process";
import { createReadStream, writeFileSync } from "node:fs";
import { basename } from "node:path";
import readXlsxFile from "read-excel-file/node";
import type { GeneratedReference } from "@/domain/bio-age/rules/reference";
import {
  detectEncoding,
  GENERATED_METRICS,
  ReferenceAccumulator,
  renderGeneratedFile,
  splitCsvLine,
} from "./aggregate";
import { parseStandardTable, summarizeStandards } from "./standard";

const DEFAULT_OUT = "src/domain/bio-age/rules/nhis-reference.generated.ts";

function parseArgs(argv: string[]) {
  const files: string[] = [];
  let encoding: string | undefined;
  let minPerGroup = 100;
  let out = DEFAULT_OUT;
  const years: number[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--encoding") encoding = argv[++i];
    else if (a === "--min-n") minPerGroup = Number(argv[++i]);
    else if (a === "--out") out = argv[++i];
    else if (a === "--year") years.push(Number(argv[++i]));
    else files.push(a);
  }
  if (!files.length) {
    console.error(
      "CSV 파일 경로를 알려 주세요: npm run bioage:reference -- <건강검진정보.csv>",
    );
    process.exit(1);
  }
  return { files, encoding, minPerGroup, out, years };
}

async function* lines(file: string, forced?: string) {
  let decoder: TextDecoder | undefined;
  let rest = "";
  for await (const chunk of createReadStream(file)) {
    const buf = chunk as Buffer;
    decoder ??= new TextDecoder(forced ?? detectEncoding(buf));
    const text = rest + decoder.decode(buf, { stream: true });
    const parts = text.split(/\r?\n/);
    rest = parts.pop() ?? "";
    yield* parts;
  }
  rest += decoder?.decode() ?? "";
  if (rest) yield rest;
}

async function fromRawCsv(
  files: string[],
  encoding: string | undefined,
  minPerGroup: number,
): Promise<{ ref: GeneratedReference; summary: string }> {
  const acc = new ReferenceAccumulator();
  for (const file of files) {
    let header = true;
    for await (const line of lines(file, encoding)) {
      if (!line.trim()) continue;
      const cells = splitCsvLine(line);
      if (header) {
        header = false;
        const missing = acc.setHeader(cells);
        if (missing.length)
          console.log(`  ${basename(file)}: 없는 열 → ${missing.join(", ")}`);
        continue;
      }
      acc.add(cells);
    }
  }
  if (acc.rows === 0) throw new Error("사용할 수 있는 행이 없습니다.");
  const ref = acc.summarize({
    source: `국민건강보험공단_건강검진정보 (${files.map((f) => basename(f)).join(", ")})`,
    minPerGroup,
  });
  return {
    ref,
    summary: `기준년도 ${ref.years.join(", ")} · 수검자 ${ref.rows.toLocaleString()}명 (제외 ${acc.skipped.toLocaleString()}행)`,
  };
}

async function fromReferenceStandards(
  files: string[],
): Promise<{ ref: GeneratedReference; summary: string }> {
  const records = [];
  const titles: string[] = [];
  for (const file of files) {
    for (const { sheet, data } of await readXlsxFile(file)) {
      const parsed = parseStandardTable(sheet, data as unknown[][]);
      console.log(
        `  ${sheet}: ${parsed.length ? `${parsed.length}행` : "생체나이에 쓰지 않는 항목 → 건너뜀"}`,
      );
      if (parsed.length) titles.push(sheet.replace(/^한국인_|_참조표준$/g, ""));
      records.push(...parsed);
    }
  }
  if (!records.length)
    throw new Error("사용할 수 있는 참조표준 행이 없습니다.");
  const ref = summarizeStandards(
    records,
    `국민건강보험공단 한국인 참조표준 (${titles.join("·")})`,
  );
  return { ref, summary: ref.source };
}

async function main() {
  const { files, encoding, minPerGroup, out, years } = parseArgs(
    process.argv.slice(2),
  );
  const xlsx = files.filter((f) => /\.xlsx$/i.test(f));
  if (xlsx.length && xlsx.length !== files.length)
    throw new Error("CSV 원자료와 xlsx 참조표준은 따로 실행해 주세요.");
  const { ref, summary } = xlsx.length
    ? await fromReferenceStandards(files)
    : await fromRawCsv(files, encoding, minPerGroup);
  if (years.length) ref.years = years;

  writeFileSync(out, renderGeneratedFile(ref));
  spawnSync("npx", ["prettier", "--write", out], { stdio: "ignore" });

  console.log(`✓ ${out}\n  ${summary}`);
  for (const metric of GENERATED_METRICS) {
    const m = ref.metrics[metric];
    const desc = (["MALE", "FEMALE"] as const)
      .map((s) => {
        const c = m?.[s];
        if (!c) return `${s === "MALE" ? "남" : "여"} 없음`;
        const total = c.n.reduce((a, b) => a + b, 0);
        return `${s === "MALE" ? "남" : "여"} ${c.ages.length}개 연령대 (${total.toLocaleString()}명)`;
      })
      .join(" · ");
    console.log(`  ${metric.padEnd(18)} ${desc}`);
  }
  console.log(
    "\n다음 단계: npm run check → 생체나이 결과 확인 → 커밋 (BIO_AGE_VERSION은 기준년도로 자동 변경)",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
