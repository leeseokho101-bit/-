/**
 * AI 출력 안전 검사 — 진단·질병 확률·약물 지시·진료 불필요 표현을 막는다.
 * 통과하지 못한 문장은 템플릿 문구로 대체한다.
 */
import { MAX_TEXT_LENGTH } from "./types";

const DISEASES =
  "당뇨병|당뇨|고혈압|고지혈증|이상지질혈증|지방간|간경화|간경변|간염|신부전|만성콩팥병|신장병|심장병|심근경색|협심증|부정맥|뇌졸중|중풍|대사증후군|비만증|동맥경화|암";

export const BANNED_PATTERNS: { id: string; pattern: RegExp }[] = [
  // "당뇨병입니다", "고혈압으로 보입니다", "지방간이 의심됩니다"
  {
    id: "disease-assertion",
    pattern: new RegExp(
      `(${DISEASES})\\s*(입니다|이에요|예요|이십니다|이세요|으로 보|로 보|일 가능성|에 해당|이 의심|가 의심|의심|환자|진단|이 있습니다|가 있습니다|에 걸|이 생겼|이 발생)`,
    ),
  },
  // "진단합니다", "진단 결과"
  {
    id: "diagnosis",
    pattern: /진단(합니다|됩니다|되었|드립니다|명|\s*결과|을 내|받으셨)/,
  },
  // "위험이 70%", "확률 30%"
  {
    id: "probability",
    pattern:
      /(\d+(\.\d+)?\s*(%|퍼센트|배)).{0,15}(위험|확률|가능성|발병)|(위험|확률|가능성|발병).{0,15}\d+(\.\d+)?\s*(%|퍼센트|배)/,
  },
  // "약을 중단하세요", "복용량을 줄이세요", "이 약을 복용하세요"
  {
    id: "medication-directive",
    pattern:
      /(약|복용|투약|처방).{0,15}(중단|끊|그만|줄이|늘리|바꾸|변경|추가)(하세요|하십시오|하셔도|해도|해야|하시기|세요)/,
  },
  {
    id: "medication-start",
    pattern:
      /(을|를)\s*(복용|투약|섭취)(하세요|하십시오|하시기 바랍니다)|약을\s*(드세요|드시기)/,
  },
  // "병원에 갈 필요가 없습니다"
  {
    id: "no-doctor",
    pattern:
      /(병원|의료진|의사|진료|검사).{0,12}(필요(가|는)?\s*없|안 가도|가지 않아도|받지 않아도)/,
  },
  // 단정적 예후
  {
    id: "prognosis",
    pattern:
      /(반드시|확실히|틀림없이).{0,15}(걸립니다|생깁니다|발생합니다|나빠집니다)/,
  },
  { id: "url", pattern: /https?:\/\// },
];

export type SafetyResult = { ok: true } | { ok: false; reason: string };

export function checkText(text: string): SafetyResult {
  if (!text.trim()) return { ok: false, reason: "empty" };
  if (text.length > MAX_TEXT_LENGTH) return { ok: false, reason: "too-long" };
  for (const { id, pattern } of BANNED_PATTERNS) {
    if (pattern.test(text)) return { ok: false, reason: id };
  }
  return { ok: true };
}
