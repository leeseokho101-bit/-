import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ageFromCode,
  detectEncoding,
  mapColumns,
  ReferenceAccumulator,
  renderGeneratedFile,
  splitCsvLine,
} from "../../scripts/bio-age-reference/aggregate";
import { buildReferences } from "@/domain/bio-age/rules/reference";

/** 공단 건강검진정보 CSV와 같은 열 이름 (값은 모두 가상으로 만든다) */
const HEADER =
  "기준년도,가입자일련번호,시도코드,성별코드,연령대코드(5세단위),신장(5cm단위),체중(5kg단위),허리둘레,시력(좌),시력(우),청력(좌),청력(우),수축기혈압,이완기혈압,식전혈당(공복혈당),총콜레스테롤,트리글리세라이드,HDL콜레스테롤,LDL콜레스테롤,혈색소,요단백,혈청크레아티닌,혈청지오티(AST),혈청지피티(ALT),감마지티피,흡연상태,음주여부";

/** 결정적 가상 데이터: 나이에 따라 오르는 혈압, 로그정규 중성지방 등 */
function virtualCsv(perGroup = 150): string {
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const normal = () =>
    Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  const rows = [HEADER];
  let id = 0;
  for (const sex of [1, 2])
    for (let code = 5; code <= 18; code++)
      for (let i = 0; i < perGroup; i++) {
        const age = (code - 1) * 5 + 2.5;
        const sbp = Math.round(
          100 + 0.4 * age + (sex === 1 ? 6 : 0) + 12 * normal(),
        );
        const tg = Math.round(100 * Math.exp(0.45 * normal()));
        const waist = i === 0 ? 999 : Math.round(80 + 10 * normal()); // 999 = 결측 코드
        rows.push(
          [
            2023,
            ++id,
            11,
            sex,
            code,
            170,
            70,
            waist,
            1.0,
            1.0,
            1,
            1,
            sbp,
            Math.round(sbp * 0.62),
            Math.round(95 + 12 * normal()),
            195,
            tg,
            52,
            118,
            (sex === 1 ? 15 : 13).toFixed(1),
            1,
            (sex === 1 ? 0.95 : 0.7).toFixed(2),
            24,
            22,
            28,
            1,
            0,
          ].join(","),
        );
      }
  // 20세 미만·성별 오류 행은 제외되어야 한다
  rows.push(
    "2023,99999,11,1,4,170,70,80,1,1,1,1,120,80,95,190,100,50,110,15,1,0.9,20,20,20,1,0",
  );
  rows.push(
    "2023,99998,11,9,9,170,70,80,1,1,1,1,120,80,95,190,100,50,110,15,1,0.9,20,20,20,1,0",
  );
  return rows.join("\n");
}

function accumulate(csv: string) {
  const [header, ...lines] = csv.split("\n");
  const acc = new ReferenceAccumulator();
  const missing = acc.setHeader(splitCsvLine(header));
  for (const l of lines) acc.add(splitCsvLine(l));
  return { acc, missing };
}

describe("NHIS 건강검진정보 → 생체나이 기준", () => {
  it("공단 CSV 열 이름을 찾는다", () => {
    const { missing } = mapColumns(splitCsvLine(HEADER));
    expect(missing).toEqual([]);
    expect(() => mapColumns(["허리둘레", "수축기혈압"])).toThrow(/성별/);
  });

  it("연령대코드(5세 단위)를 중앙 나이로 바꾸고 20세 미만은 뺀다", () => {
    expect(ageFromCode(5)).toBe(22.5);
    expect(ageFromCode(9)).toBe(42.5);
    expect(ageFromCode(18)).toBe(87.5);
    expect(ageFromCode(4)).toBeNull();
    expect(ageFromCode(19)).toBeNull();
  });

  it("성별·연령대별 평균과 퍼짐을 계산한다", () => {
    const { acc } = accumulate(virtualCsv());
    expect(acc.rows).toBe(2 * 14 * 150);
    expect(acc.skipped).toBe(2);
    const ref = acc.summarize({ source: "가상", minPerGroup: 100 });
    expect(ref.years).toEqual([2023]);

    const sbp = ref.metrics.SBP!.MALE!;
    expect(sbp.ages).toHaveLength(14);
    expect(sbp.ages[0]).toBe(22.5);
    // 가상 데이터의 참값: 100 + 0.4 × 나이 + 6, 표준편차 12
    expect(sbp.mean[0]).toBeGreaterThan(110);
    expect(sbp.mean[0]).toBeLessThan(120);
    expect(sbp.mean[13]).toBeGreaterThan(sbp.mean[0] + 20);
    expect(sbp.spread[0]).toBeGreaterThan(9);
    expect(sbp.spread[0]).toBeLessThan(15);

    // 로그 척도: 기하평균 ≈ 100, 기하표준편차 ≈ e^0.45
    const tg = ref.metrics.TRIGLYCERIDE!.FEMALE!;
    expect(tg.mean[3]).toBeGreaterThan(85);
    expect(tg.mean[3]).toBeLessThan(115);
    expect(tg.spread[3]).toBeGreaterThan(1.4);
    expect(tg.spread[3]).toBeLessThan(1.75);

    // 허리둘레 999(결측 코드)는 제외
    expect(ref.metrics.WAIST!.MALE!.n[0]).toBe(149);
    // eGFR은 크레아티닌으로 계산되고 나이가 들수록 낮아진다
    const egfr = ref.metrics.EGFR!.MALE!;
    expect(egfr.mean[0]).toBeGreaterThan(egfr.mean[13]);
    // 당화혈색소는 원자료에 없다
    expect(ref.metrics.HBA1C).toBeUndefined();
  });

  it("표본이 적은 연령대는 빼고, 연령대가 모자라면 초안 값을 쓴다", () => {
    const { acc } = accumulate(virtualCsv(30));
    const few = acc.summarize({ source: "가상", minPerGroup: 100 });
    expect(few.metrics.SBP).toBeUndefined();
    const refs = buildReferences(few);
    expect(refs.SBP.curves.MALE.source).toBe("DRAFT");
  });

  it("생성 결과가 있으면 그 곡선을 쓰고, 없는 지표는 초안을 유지한다", () => {
    const ref = accumulate(virtualCsv()).acc.summarize({ source: "가상" });
    const refs = buildReferences(ref);
    expect(refs.SBP.curves.MALE.source).toBe("NHIS");
    expect(refs.SBP.curves.MALE.mean).toEqual(ref.metrics.SBP!.MALE!.mean);
    expect(refs.HBA1C.curves.FEMALE.source).toBe("DRAFT");
    expect(renderGeneratedFile(ref)).toContain(
      "export const NHIS_REFERENCE: GeneratedReference | null =",
    );
  });

  it("공단 CSV 기본 인코딩(EUC-KR)과 UTF-8을 구분한다", () => {
    const eucKr = Uint8Array.from([0xbc, 0xba, 0xba, 0xb0, 0x2c, 0x31]); // "성별,1"
    expect(detectEncoding(eucKr)).toBe("euc-kr");
    expect(detectEncoding(new TextEncoder().encode("성별,1\n"))).toBe("utf-8");
  });

  it("명령어로 생성 파일을 만든다", () => {
    const dir = mkdtempSync(join(tmpdir(), "bioage-ref-"));
    const csv = join(dir, "virtual.csv");
    const out = join(dir, "out.ts");
    writeFileSync(csv, virtualCsv());
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "--tsconfig",
        "tsconfig.json",
        "scripts/bio-age-reference/build.ts",
        csv,
        "--out",
        out,
      ],
      { encoding: "utf8" },
    );
    expect(r.status, r.stderr).toBe(0);
    const text = readFileSync(out, "utf8");
    expect(text).toContain("NHIS_REFERENCE");
    expect(text).toContain("2023");
  }, 60_000);
});
