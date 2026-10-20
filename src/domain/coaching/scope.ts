/**
 * 코칭 범위 규칙 — 코칭은 생활습관(식사·운동·생활)으로 한정한다 (계획서 3-3, 8장 "의료법(의료행위)").
 * 코치가 진단·약 지시·용량 수치를 쓰면 보내지 않고, 환자의 약·용량 질문은 담당 의사에게 안내한다.
 */
import { BANNED_PATTERNS } from "@/domain/narrative/safety";

export const MESSAGE_MAX_LENGTH = 1000;

/** AI 출력 금지 표현(링크 제외) + 코치 전용 규칙 */
const COACH_PATTERNS: { id: string; pattern: RegExp }[] = [
  ...BANNED_PATTERNS.filter((p) => p.id !== "url"),
  // "5mg", "2.5 mg" 같은 용량 수치 (혈당 단위 mg/dL은 제외)
  {
    id: "dose-number",
    pattern: /\d+(\.\d+)?\s*(mg|㎎|밀리그램)(?!\s*\/\s*dl)|\d+\s*단위/i,
  },
  // "증량해 보세요", "용량을 올리면"
  {
    id: "dose-change",
    pattern:
      /(증량|감량|용량).{0,10}(하세요|해 보세요|해보세요|하시면|올리|내리|높이|낮추)/,
  },
  // "주사 쉬어도 돼요", "한 번 건너뛰세요"
  {
    id: "skip-dose",
    pattern:
      /(주사|투약|약).{0,10}(쉬어|건너뛰|빼먹어도|미뤄|안 맞아도|안 드셔도)/,
  },
];

export type ScopeResult = { ok: true } | { ok: false; reason: string };

export function checkCoachMessage(text: string): ScopeResult {
  const t = text.trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length > MESSAGE_MAX_LENGTH) return { ok: false, reason: "too-long" };
  for (const { id, pattern } of COACH_PATTERNS)
    if (pattern.test(t)) return { ok: false, reason: id };
  return { ok: true };
}

/** 환자 메시지가 약·용량·투약 일정 문의로 보이는지 */
export function isMedicationQuestion(text: string): boolean {
  return /(약|용량|증량|감량|주사|처방|복용|투약|mg(?!\s*\/\s*dl)|㎎|끊어|중단|건너뛰)/i.test(
    text,
  );
}

/** 약·용량 문의에 코치가 바로 쓸 수 있는 답장 */
export const MEDICATION_REPLY =
  "약과 용량, 투약 일정에 관한 질문은 담당 의사가 답할 수 있어요. 다음 진료 때 여쭤보시거나 의원에 연락해 주세요. 필요하면 제가 담당 의원에 확인을 요청해 둘게요. 식사와 운동은 제가 계속 함께할게요.";
