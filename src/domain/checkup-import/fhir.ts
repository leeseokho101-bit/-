import type { ImportableCode, RawCheckupData, RawCheckupItem } from "./types";

/**
 * HL7 FHIR R4 Observation → 공통 형식 변환기 (검진기관 연동용).
 *
 * 국내외 병원·검진기관 정보시스템과 보건복지부 '건강정보 고속도로'는
 * FHIR 표준을 사용하므로, 검사 항목을 LOINC 코드로 식별한다.
 */
export const LOINC_TO_METRIC: Record<string, ImportableCode> = {
  "8302-2": "HEIGHT", // Body height
  "29463-7": "WEIGHT", // Body weight
  "8280-0": "WAIST", // Waist circumference
  "8480-6": "SBP", // Systolic blood pressure
  "8462-4": "DBP", // Diastolic blood pressure
  "1558-6": "FASTING_GLUCOSE", // Fasting glucose
  "4548-4": "HBA1C", // Hemoglobin A1c
  "2093-3": "TOTAL_CHOLESTEROL", // Cholesterol
  "13457-7": "LDL", // LDL (calculated)
  "18262-6": "LDL", // LDL (direct)
  "2089-1": "LDL", // LDL
  "2085-9": "HDL", // HDL
  "2571-8": "TRIGLYCERIDE", // Triglyceride
  "1920-8": "AST", // AST
  "1742-6": "ALT", // ALT
  "2324-2": "GGT", // GGT
  "2160-0": "CREATININE", // Creatinine
  "718-7": "HEMOGLOBIN", // Hemoglobin
  "33914-3": "EGFR", // eGFR (MDRD)
  "62238-1": "EGFR", // eGFR (CKD-EPI)
  "98979-8": "EGFR", // eGFR (CKD-EPI 2021)
};

const LOINC_SYSTEM = "http://loinc.org";

/** 필요한 필드만 정의한 FHIR Observation (외부 입력이라 모두 선택값) */
export type FhirQuantity = { value?: number; unit?: string; code?: string };
export type FhirCodeableConcept = {
  coding?: { system?: string; code?: string }[];
};
export type FhirObservation = {
  resourceType?: string;
  status?: string;
  code?: FhirCodeableConcept;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  component?: { code?: FhirCodeableConcept; valueQuantity?: FhirQuantity }[];
};

function metricOf(code?: FhirCodeableConcept): ImportableCode | undefined {
  for (const c of code?.coding ?? []) {
    if ((!c.system || c.system === LOINC_SYSTEM) && c.code) {
      const m = LOINC_TO_METRIC[c.code];
      if (m) return m;
    }
  }
  return undefined;
}

function itemOf(
  metric: ImportableCode | undefined,
  q: FhirQuantity | undefined,
): RawCheckupItem | undefined {
  if (!metric || typeof q?.value !== "number") return undefined;
  // UCUM 코드(code)가 표시용 unit보다 정확하다
  return { metric, value: q.value, unit: q.code ?? q.unit };
}

/** 취소·오류 처리된 결과는 제외 */
const USABLE_STATUS = new Set(["final", "amended", "corrected", "preliminary"]);

/**
 * Observation 목록 → 공통 형식.
 * 같은 항목이 여러 번 있으면 가장 최근 검사값을 쓰고, 검진일은 가장 최근 날짜로 한다.
 * 혈압 패널(85354-9)처럼 component로 온 값도 읽는다.
 */
export function fromFhirObservations(
  observations: FhirObservation[],
): RawCheckupData {
  const usable = observations
    .filter(
      (o) =>
        o.resourceType === "Observation" &&
        (!o.status || USABLE_STATUS.has(o.status)),
    )
    .sort((a, b) =>
      (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""),
    );

  const items: RawCheckupItem[] = [];
  const seen = new Set<ImportableCode>();
  let latest: string | undefined;
  const push = (o: FhirObservation, item: RawCheckupItem | undefined) => {
    if (item && !seen.has(item.metric)) {
      seen.add(item.metric);
      items.push(item);
      // 검진일은 실제로 가져온 값의 가장 최근 검사일
      latest ??= o.effectiveDateTime;
    }
  };
  for (const o of usable) {
    push(o, itemOf(metricOf(o.code), o.valueQuantity));
    for (const c of o.component ?? [])
      push(o, itemOf(metricOf(c.code), c.valueQuantity));
  }
  return { checkupDate: latest ? latest.slice(0, 10) : null, items };
}
