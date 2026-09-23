/** 한국어 조사 선택: 마지막 글자의 받침 유무로 은/는, 이/가, 을/를, 과/와 를 고른다 */
const PAIRS = {
  "은/는": ["은", "는"],
  "이/가": ["이", "가"],
  "을/를": ["을", "를"],
  "과/와": ["과", "와"],
} as const;

export function hasBatchim(word: string): boolean {
  const ch = word.trim().at(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // 숫자·영문 끝: 읽는 소리 기준 (0,1,3,6,7,8, L,M,N,R 등은 받침 있음)
  return /[013678lmnr]$/i.test(ch);
}

export function josa(word: string, pair: keyof typeof PAIRS): string {
  const [withB, withoutB] = PAIRS[pair];
  return `${word}${hasBatchim(word) ? withB : withoutB}`;
}
