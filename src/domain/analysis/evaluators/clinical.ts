/** 검진 수치 기반 영역: 체중 · 대사 · 심혈관 · 혈당 · 간 · 신장 */
import { thresholds as T } from "../rules/thresholds";
import type { DomainResult, Finding, HealthSnapshot } from "../types";
import { buildDomainResult, finding, isPresent } from "./common";

export function evaluateWeight(s: HealthSnapshot): DomainResult {
  const { BMI, WAIST } = s.metrics;
  const sex = s.demographics.sex;
  const f: Finding[] = [];

  if (isPresent(BMI)) {
    if (BMI < T.bmi.underweight)
      f.push(finding("BMI", BMI, "BORDERLINE", "weight.bmi.under", 50));
    else if (BMI < T.bmi.preObese)
      f.push(finding("BMI", BMI, "OPTIMAL", "weight.bmi.normal"));
    else if (BMI < T.bmi.obese)
      f.push(finding("BMI", BMI, "BORDERLINE", "weight.bmi.preobese", 50));
    else if (BMI < T.bmi.obeseSevere)
      f.push(finding("BMI", BMI, "ELEVATED", "weight.bmi.obese", 80));
    else f.push(finding("BMI", BMI, "ELEVATED", "weight.bmi.obese2", 95));
  }
  if (isPresent(WAIST)) {
    const w = T.waist[sex];
    if (WAIST >= w.elevated)
      f.push(finding("WAIST", WAIST, "ELEVATED", "weight.waist.high", 80));
    else if (WAIST >= w.borderline)
      f.push(
        finding("WAIST", WAIST, "BORDERLINE", "weight.waist.borderline", 50),
      );
    else f.push(finding("WAIST", WAIST, "OPTIMAL", "weight.waist.normal"));
  }

  return buildDomainResult({
    domain: "WEIGHT",
    findings: f,
    requiredInputs: 2,
    providedInputs: [BMI, WAIST].filter(isPresent).length,
    rule: "clinical",
  });
}

/** 대사건강: 5개 요소 중 해당 개수 (복용 목적상 관리 중인 요소는 해당으로 본다 — 국제 기준과 동일) */
export function evaluateMetabolic(s: HealthSnapshot): DomainResult {
  const { WAIST, SBP, DBP, FASTING_GLUCOSE, TRIGLYCERIDE, HDL } = s.metrics;
  const sex = s.demographics.sex;
  const M = T.metabolic;
  const bpManaged = s.managed.includes("BLOOD_PRESSURE");
  const glucoseManaged = s.managed.includes("GLUCOSE");
  const lipidManaged = s.managed.includes("LIPID");

  // [요소, 입력 여부, 해당 여부]
  const components: [string, boolean, boolean][] = [
    ["waist", isPresent(WAIST), isPresent(WAIST) && WAIST >= M.waist[sex]],
    [
      "bloodPressure",
      bpManaged || (isPresent(SBP) && isPresent(DBP)),
      bpManaged ||
        (isPresent(SBP) && isPresent(DBP) && (SBP >= M.sbp || DBP >= M.dbp)),
    ],
    [
      "glucose",
      glucoseManaged || isPresent(FASTING_GLUCOSE),
      glucoseManaged ||
        (isPresent(FASTING_GLUCOSE) && FASTING_GLUCOSE >= M.fastingGlucose),
    ],
    [
      "triglyceride",
      lipidManaged || isPresent(TRIGLYCERIDE),
      lipidManaged ||
        (isPresent(TRIGLYCERIDE) && TRIGLYCERIDE >= M.triglyceride),
    ],
    ["hdl", isPresent(HDL), isPresent(HDL) && HDL < M.hdl[sex]],
  ];

  const provided = components.filter(([, has]) => has).length;
  const count = components.filter(([, , hit]) => hit).length;
  const f: Finding[] = components
    .filter(([, has]) => has)
    .map(([name, , hit]) =>
      finding(
        `metabolic.${name}`,
        hit,
        hit ? "BORDERLINE" : "OPTIMAL",
        `metabolic.${name}.${hit ? "hit" : "ok"}`,
        0,
      ),
    );

  // 요소 개수로 영역 판정: 0 양호, 1 보통, 2 관심, 3개 이상 관리 필요
  const [band, points] =
    count >= 3
      ? (["ELEVATED", count >= 4 ? 95 : 85] as const)
      : count === 2
        ? (["BORDERLINE", 60] as const)
        : count === 1
          ? (["NORMAL", 25] as const)
          : (["OPTIMAL", 0] as const);
  // 3개 미만 입력인데 해당 개수가 적으면 판단 보류
  const summary =
    provided >= 3 || count >= 3
      ? [
          finding(
            "metabolic.count",
            count,
            band,
            `metabolic.count.${count}`,
            points,
          ),
        ]
      : [];

  const result = buildDomainResult({
    domain: "METABOLIC",
    findings: summary,
    requiredInputs: 5,
    providedInputs: provided,
    rule: "clinical",
    managed: bpManaged || glucoseManaged || lipidManaged,
  });
  // 요소별 근거는 설명용으로 덧붙인다 (점수 계산에는 요약값만 사용)
  return { ...result, findings: [...result.findings, ...f] };
}

export function evaluateCardiovascular(s: HealthSnapshot): DomainResult {
  const { SBP, DBP, LDL, TOTAL_CHOLESTEROL, HDL } = s.metrics;
  const bp = T.bloodPressure;
  const f: Finding[] = [];

  if (isPresent(SBP) && isPresent(DBP)) {
    if (SBP >= bp.hypertension.sbp || DBP >= bp.hypertension.dbp)
      f.push(finding("BP", `${SBP}/${DBP}`, "ELEVATED", "cardio.bp.high"));
    else if (SBP >= bp.prehypertension.sbp || DBP >= bp.prehypertension.dbp)
      f.push(finding("BP", `${SBP}/${DBP}`, "BORDERLINE", "cardio.bp.pre"));
    else if (SBP >= bp.optimal.sbp)
      f.push(finding("BP", `${SBP}/${DBP}`, "NORMAL", "cardio.bp.elevated"));
    else f.push(finding("BP", `${SBP}/${DBP}`, "OPTIMAL", "cardio.bp.normal"));
  }
  if (isPresent(LDL)) {
    if (LDL >= T.ldl.elevated)
      f.push(finding("LDL", LDL, "ELEVATED", "cardio.ldl.high"));
    else if (LDL >= T.ldl.borderline)
      f.push(finding("LDL", LDL, "BORDERLINE", "cardio.ldl.borderline"));
    else if (LDL >= T.ldl.optimal)
      f.push(finding("LDL", LDL, "NORMAL", "cardio.ldl.nearOptimal"));
    else f.push(finding("LDL", LDL, "OPTIMAL", "cardio.ldl.optimal"));
  }
  if (isPresent(TOTAL_CHOLESTEROL)) {
    const tc = TOTAL_CHOLESTEROL;
    if (tc >= T.totalCholesterol.elevated)
      f.push(finding("TOTAL_CHOLESTEROL", tc, "ELEVATED", "cardio.tc.high"));
    else if (tc >= T.totalCholesterol.borderline)
      f.push(
        finding("TOTAL_CHOLESTEROL", tc, "BORDERLINE", "cardio.tc.borderline"),
      );
    else
      f.push(finding("TOTAL_CHOLESTEROL", tc, "OPTIMAL", "cardio.tc.normal"));
  }
  if (isPresent(HDL)) {
    if (HDL < T.hdl.low)
      f.push(finding("HDL", HDL, "BORDERLINE", "cardio.hdl.low"));
    else if (HDL < T.hdl.optimal)
      f.push(finding("HDL", HDL, "NORMAL", "cardio.hdl.normal"));
    else f.push(finding("HDL", HDL, "OPTIMAL", "cardio.hdl.good"));
  }
  // 흡연은 심혈관 관리의 중요한 요소로 함께 반영 (생활습관 영역과 중복 반영되므로 '관심' 수준으로)
  const smoking = s.survey.smoking.status;
  if (smoking === "CURRENT")
    f.push(
      finding(
        "smoking.status",
        smoking,
        "BORDERLINE",
        "cardio.smoking.current",
        65,
      ),
    );
  else if (smoking === "FORMER")
    f.push(
      finding("smoking.status", smoking, "NORMAL", "cardio.smoking.former"),
    );
  else if (smoking === "NEVER")
    f.push(
      finding("smoking.status", smoking, "OPTIMAL", "cardio.smoking.never"),
    );

  return buildDomainResult({
    domain: "CARDIOVASCULAR",
    findings: f,
    requiredInputs: 5,
    providedInputs: [SBP, LDL, TOTAL_CHOLESTEROL, HDL, smoking].filter(
      isPresent,
    ).length,
    rule: "clinical",
    managed:
      s.managed.includes("BLOOD_PRESSURE") || s.managed.includes("LIPID"),
  });
}

export function evaluateGlycemic(s: HealthSnapshot): DomainResult {
  const { FASTING_GLUCOSE: fbg, HBA1C: a1c } = s.metrics;
  const f: Finding[] = [];
  if (isPresent(fbg)) {
    if (fbg >= T.fastingGlucose.elevated)
      f.push(
        finding("FASTING_GLUCOSE", fbg, "ELEVATED", "glycemic.fbg.high", 90),
      );
    else if (fbg >= T.fastingGlucose.borderline)
      f.push(
        finding(
          "FASTING_GLUCOSE",
          fbg,
          "BORDERLINE",
          "glycemic.fbg.borderline",
          65,
        ),
      );
    else
      f.push(finding("FASTING_GLUCOSE", fbg, "OPTIMAL", "glycemic.fbg.normal"));
  }
  if (isPresent(a1c)) {
    if (a1c >= T.hba1c.elevated)
      f.push(finding("HBA1C", a1c, "ELEVATED", "glycemic.a1c.high", 90));
    else if (a1c >= T.hba1c.borderline)
      f.push(
        finding("HBA1C", a1c, "BORDERLINE", "glycemic.a1c.borderline", 65),
      );
    else f.push(finding("HBA1C", a1c, "OPTIMAL", "glycemic.a1c.normal"));
  }
  return buildDomainResult({
    domain: "GLYCEMIC",
    findings: f,
    requiredInputs: 2,
    providedInputs: [fbg, a1c].filter(isPresent).length,
    rule: "clinical",
    managed: s.managed.includes("GLUCOSE"),
  });
}

export function evaluateLiver(s: HealthSnapshot): DomainResult {
  const { AST, ALT, GGT } = s.metrics;
  const sex = s.demographics.sex;
  const f: Finding[] = [];
  for (const [code, v] of [
    ["AST", AST],
    ["ALT", ALT],
  ] as const) {
    if (!isPresent(v)) continue;
    const key = code.toLowerCase();
    if (v >= T.astAlt.elevated)
      f.push(finding(code, v, "ELEVATED", `liver.${key}.high`, 75));
    else if (v >= T.astAlt.borderline)
      f.push(finding(code, v, "BORDERLINE", `liver.${key}.borderline`, 50));
    else f.push(finding(code, v, "OPTIMAL", `liver.${key}.normal`));
  }
  if (isPresent(GGT)) {
    const g = T.ggt[sex];
    if (GGT >= g.elevated)
      f.push(finding("GGT", GGT, "ELEVATED", "liver.ggt.high", 75));
    else if (GGT >= g.borderline)
      f.push(finding("GGT", GGT, "BORDERLINE", "liver.ggt.borderline", 50));
    else f.push(finding("GGT", GGT, "OPTIMAL", "liver.ggt.normal"));
  }
  return buildDomainResult({
    domain: "LIVER",
    findings: f,
    requiredInputs: 3,
    providedInputs: [AST, ALT, GGT].filter(isPresent).length,
    rule: "clinical",
  });
}

export function evaluateKidney(s: HealthSnapshot): DomainResult {
  const { CREATININE: cr, EGFR: egfr } = s.metrics;
  const f: Finding[] = [];
  if (isPresent(egfr)) {
    if (egfr < T.egfr.elevated)
      f.push(finding("EGFR", egfr, "ELEVATED", "kidney.egfr.low", 75));
    else if (egfr < T.egfr.optimal)
      f.push(finding("EGFR", egfr, "NORMAL", "kidney.egfr.mild"));
    else f.push(finding("EGFR", egfr, "OPTIMAL", "kidney.egfr.normal"));
  }
  if (isPresent(cr)) {
    if (cr > T.creatinine.elevated)
      f.push(finding("CREATININE", cr, "ELEVATED", "kidney.cr.high", 75));
    else f.push(finding("CREATININE", cr, "OPTIMAL", "kidney.cr.normal"));
  }
  return buildDomainResult({
    domain: "KIDNEY",
    findings: f,
    requiredInputs: 2,
    providedInputs: [cr, egfr].filter(isPresent).length,
    rule: "clinical",
  });
}
