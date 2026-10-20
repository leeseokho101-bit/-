/** 의사 대시보드 문구. 판단·권고는 하지 않고 기록된 사실과 참고 지표만 보여준다. */
import type { AlertKind } from "@/domain/glp1/alerts";
import type { FlagReason, PatientFlag } from "@/domain/glp1/clinic";
import type { TriageLevel } from "@/domain/glp1/symptoms";

/** 상태는 색만으로 구분하지 않는다: 아이콘 + 글자 함께 */
export const flagContent: Record<
  PatientFlag,
  { label: string; icon: string; className: string }
> = {
  ALERT: {
    label: "확인 필요",
    icon: "⚠",
    className: "border-rose-300 bg-rose-50 text-rose-900",
  },
  WATCH: {
    label: "관찰",
    icon: "◐",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  OK: {
    label: "양호",
    icon: "●",
    className: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
};

export const alertLabels: Record<AlertKind, string> = {
  SEVERE_SYMPTOM: "체크인 위험 신호·심한 증상",
  PERSISTENT_VOMITING: "구토 3일 이상 지속",
  LOW_GLUCOSE: "CGM <70mg/dL 구간 반복 (7일 2회 이상)",
  SEVERE_LOW_GLUCOSE: "CGM <54mg/dL 15분 이상",
  MISSED_DOSES: "투약 누락 (최근 4주)",
};

export const levelLabels: Record<TriageLevel, string> = {
  NONE: "-",
  SELF_CARE: "생활 대처",
  CONTACT_CLINIC: "의원 연락 안내",
  URGENT: "즉시 진료 안내",
};

export function reasonText(r: FlagReason): string {
  switch (r.kind) {
    case "alert":
      return alertLabels[r.alert];
    case "low-adherence":
      return `복용률 ${Math.round(r.rate * 100)}%`;
    case "no-check-in":
      return r.days === null ? "체크인 기록 없음" : `체크인 ${r.days}일째 없음`;
  }
}

export const roleLabels = { DOCTOR: "의사", NURSE: "간호사" } as const;

export const clinicReportNote =
  '환자가 앱에 기록한 값을 모은 참고 자료입니다. 증량·투약 판단은 진료를 통해 의료진이 결정합니다. 환자가 "담당 의원 공유"에 동의한 경우에만 표시됩니다.';

export const referenceNote =
  "증량 여부를 제안하지 않습니다. 진료 판단에 참고할 수 있도록 관련 기록만 나란히 보여드려요.";

/** 용량 유지 기간: "6일", "2주 3일" */
export function durationText(days: number): string {
  const w = Math.floor(days / 7);
  const d = days % 7;
  return w ? `${w}주${d ? ` ${d}일` : ""}` : `${d}일`;
}
