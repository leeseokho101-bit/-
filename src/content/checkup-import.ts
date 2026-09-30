import { METRICS } from "@/domain/health-snapshot/metrics";
import type { ImportWarning } from "@/domain/checkup-import/types";

/** 사진 판독 이용 시 매번 받는 동의 (출시 전 법률 검토 필요 — docs/PRIVACY_AND_COMPLIANCE.md) */
export const PHOTO_CONSENT_ITEMS = [
  "촬영한 결과표 사진은 수치를 읽기 위해 AI 서비스(Anthropic, 미국)로 전송됩니다.",
  "사진은 판독에만 사용하고 저장하지 않습니다. 읽은 수치는 확인 후 저장할 때만 보관됩니다.",
  "사진에 이름·주민등록번호가 보이면 가리고 찍어 주세요.",
] as const;

export const PHOTO_TIPS = [
  "결과표를 평평한 곳에 놓고 수치가 있는 면 전체가 나오게 찍어 주세요.",
  "그림자·빛 반사가 없도록 밝은 곳에서 찍으면 더 정확합니다.",
  "여러 장이면 수치가 가장 많은 장(검사 결과 표)을 먼저 올려 주세요.",
] as const;

/** 사용자에게 보여줄 판독 경고 문구 */
export function importWarningText(w: ImportWarning): string {
  const label = w.metric ? METRICS[w.metric].label : "";
  switch (w.kind) {
    case "unknown-unit":
      return `${label}: 단위를 확인할 수 없어 가져오지 않았어요. 직접 입력해 주세요.`;
    case "unit-converted":
      return `${label}: 결과표의 단위를 ${w.metric ? METRICS[w.metric].unit : ""}로 바꿨어요. 값을 확인해 주세요.`;
    case "out-of-range":
      return `${label}: 읽은 값이 입력 가능한 범위를 벗어나 가져오지 않았어요. 직접 입력해 주세요.`;
    case "duplicate":
      return `${label}: 같은 항목이 여러 번 보여 첫 번째 값을 가져왔어요.`;
    case "bp-order":
      return "혈압: 두 값의 순서가 맞지 않아 가져오지 않았어요. 직접 입력해 주세요.";
    case "invalid-date":
      return "검진 날짜를 정확히 읽지 못했어요. 필요하면 직접 입력해 주세요.";
  }
}
