/**
 * 하루 1분 부작용 체크인 → 안내 단계 (규칙 기반, 결정적).
 *
 * 단계
 * - NONE: 불편한 증상 없음
 * - SELF_CARE: 생활 속 대처 안내
 * - CONTACT_CLINIC: 담당 의원에 연락해 상담 (심한 증상, 위험 신호)
 * - URGENT: 바로 진료 (참기 힘든 복통, 물도 못 마심, 붓기·호흡곤란 등)
 *
 * 진단하지 않는다. 증상의 원인을 말하지 않고 "어디에 연락할지"만 안내한다.
 * 위험 신호 목록은 GLP-1 계열 허가사항의 "즉시 의사와 상의" 항목을 생활 언어로 옮긴 초안이며,
 * 출시 전 의학 감수가 필요하다 (docs/RULES_REFERENCE.md §7).
 */
export const SYMPTOMS = [
  "NAUSEA",
  "VOMITING",
  "DIARRHEA",
  "CONSTIPATION",
  "ABDOMINAL_PAIN",
  "FATIGUE",
] as const;
export type SymptomCode = (typeof SYMPTOMS)[number];

/** 0 없음 · 1 약간 · 2 보통 · 3 심함 */
export type Severity = 0 | 1 | 2 | 3;
export const SEVERITIES = [0, 1, 2, 3] as const;

export const RED_FLAGS = [
  "SEVERE_ABDOMINAL_PAIN",
  "CANNOT_KEEP_FLUIDS",
  "SWELLING_BREATHING",
  "LOW_GLUCOSE_SYMPTOMS",
  "DEHYDRATION_SIGNS",
] as const;
export type RedFlagCode = (typeof RED_FLAGS)[number];

export const TRIAGE_LEVELS = [
  "NONE",
  "SELF_CARE",
  "CONTACT_CLINIC",
  "URGENT",
] as const;
export type TriageLevel = (typeof TRIAGE_LEVELS)[number];

const RED_FLAG_LEVEL: Record<RedFlagCode, TriageLevel> = {
  SEVERE_ABDOMINAL_PAIN: "URGENT",
  CANNOT_KEEP_FLUIDS: "URGENT",
  SWELLING_BREATHING: "URGENT",
  LOW_GLUCOSE_SYMPTOMS: "CONTACT_CLINIC",
  DEHYDRATION_SIGNS: "CONTACT_CLINIC",
};

export type SymptomScores = Record<SymptomCode, Severity>;

export type CheckInInput = {
  symptoms: SymptomScores;
  redFlags: RedFlagCode[];
};

export type TriageReason =
  | { kind: "red-flag"; code: RedFlagCode }
  | { kind: "severe"; code: SymptomCode }
  | { kind: "vomiting" }
  | { kind: "symptom"; code: SymptomCode };

export type Triage = {
  level: TriageLevel;
  reasons: TriageReason[];
  /** 대처 안내를 보여줄 증상 (점수 높은 순, 같으면 목록 순) */
  coping: SymptomCode[];
};

const rank = (l: TriageLevel) => TRIAGE_LEVELS.indexOf(l);
export const maxLevel = (a: TriageLevel, b: TriageLevel): TriageLevel =>
  rank(a) >= rank(b) ? a : b;

export function triageCheckIn(input: CheckInInput): Triage {
  let level: TriageLevel = "NONE";
  const reasons: TriageReason[] = [];
  for (const code of RED_FLAGS) {
    if (!input.redFlags.includes(code)) continue;
    level = maxLevel(level, RED_FLAG_LEVEL[code]);
    reasons.push({ kind: "red-flag", code });
  }
  for (const code of SYMPTOMS) {
    const s = input.symptoms[code];
    if (s === 3) {
      level = maxLevel(level, "CONTACT_CLINIC");
      reasons.push({ kind: "severe", code });
    } else if (code === "VOMITING" && s === 2) {
      // 구토는 탈수로 이어지기 쉬워 "보통"부터 의원 상담 안내
      level = maxLevel(level, "CONTACT_CLINIC");
      reasons.push({ kind: "vomiting" });
    } else if (s > 0) {
      level = maxLevel(level, "SELF_CARE");
      reasons.push({ kind: "symptom", code });
    }
  }
  const coping = SYMPTOMS.filter((c) => input.symptoms[c] > 0).sort(
    (a, b) => input.symptoms[b] - input.symptoms[a],
  );
  return { level, reasons, coping };
}

export function emptySymptoms(): SymptomScores {
  return Object.fromEntries(SYMPTOMS.map((c) => [c, 0])) as SymptomScores;
}

/** 저장된 JSON → 점수 (모르는 값은 0) */
export function parseSymptoms(raw: unknown): SymptomScores {
  const out = emptySymptoms();
  if (raw && typeof raw === "object") {
    for (const c of SYMPTOMS) {
      const v = (raw as Record<string, unknown>)[c];
      if (v === 1 || v === 2 || v === 3) out[c] = v;
    }
  }
  return out;
}

export function parseRedFlags(raw: unknown): RedFlagCode[] {
  if (!Array.isArray(raw)) return [];
  return RED_FLAGS.filter((c) => raw.includes(c));
}
