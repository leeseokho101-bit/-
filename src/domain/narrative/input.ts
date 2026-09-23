/**
 * LLM 입력 생성 — 엔진 결과(구조화 JSON)만 사용한다.
 * 이름·이메일·생년월일 등 식별정보는 포함하지 않는다. 나이는 연령대로만 전달한다.
 */
import { domainContent, statusContent } from "@/content/domains";
import { findingText } from "@/content/findings";
import type {
  AnalysisOutput,
  DomainCode,
  DomainResult,
  PriorityItem,
} from "@/domain/analysis/types";
import {
  METRICS,
  METRIC_CODES,
  type MetricCode,
} from "@/domain/health-snapshot/metrics";

export type NarrativeInput = {
  person: { ageGroup: string; sex: "남성" | "여성" };
  domains: {
    code: DomainCode;
    name: string;
    status: string;
    managementLevel: number | null;
    facts: string[];
    currentlyManaged: boolean;
  }[];
  priorities: {
    rank: number;
    code: DomainCode;
    name: string;
    type: "개선" | "유지";
    reasons: string[];
    relatedAreas: string[];
    /** 순위와 상태 단계가 어긋날 때의 설명 힌트 */
    orderNote?: string;
  }[];
};

export function ageGroup(age: number): string {
  if (age < 20) return "10대";
  return `${Math.min(Math.floor(age / 10) * 10, 90)}대`;
}

const isMetric = (item: string): item is MetricCode =>
  (METRIC_CODES as readonly string[]).includes(item);

/** 문장 맨 앞의 지표 이름 뒤에 수치를 넣는다: "공복혈당이 …" → "공복혈당(119 mg/dL)이 …" */
export function withValue(text: string, label: string, value: string): string {
  const base = label.split("(")[0].trim();
  if (label.endsWith(")") && text.startsWith(label)) {
    return `${label.slice(0, -1)}, ${value})${text.slice(label.length)}`;
  }
  if (text.startsWith(base))
    return `${base}(${value})${text.slice(base.length)}`;
  return `${label}(${value}): ${text}`;
}

/** finding → "공복혈당(119 mg/dL)이 관심이 필요한 경계 범위에 있어요." */
export function factOf(f: DomainResult["findings"][number]): string | null {
  const text = findingText(f.messageKey);
  if (!text) return null;
  if (isMetric(f.item) && typeof f.value === "number") {
    const m = METRICS[f.item];
    return withValue(
      text,
      m.label,
      `${f.value}${m.unit === "%" ? "%" : ` ${m.unit}`}`,
    );
  }
  if (f.item === "BP" && typeof f.value === "string")
    return withValue(text, "혈압", `${f.value} mmHg`);
  return text;
}

/** 관심 단계 영역이 관리 필요 영역보다 앞선 경우 이유를 설명하기 위한 힌트 */
export function orderNoteFor(
  p: PriorityItem,
  all: PriorityItem[],
  byCode: Map<DomainCode, DomainResult>,
) {
  const status = byCode.get(p.domain)?.status;
  const laterMoreSevere = all.some(
    (q) =>
      q.rank > p.rank && byCode.get(q.domain)?.status === "MANAGEMENT_NEEDED",
  );
  if (p.mode === "IMPROVE" && status === "ATTENTION" && laterMoreSevere) {
    return "현재 단계는 '관심'이지만 관련 지표가 여러 개 함께 경계 범위에 있고, 지금 관리하면 효과가 큰 영역이라 먼저 살펴보는 것을 권해요.";
  }
  return undefined;
}

export function buildNarrativeInput(
  output: AnalysisOutput,
  person: { age: number; sex: "MALE" | "FEMALE" },
): NarrativeInput {
  const byCode = new Map(output.domains.map((d) => [d.domain, d]));
  return {
    person: {
      ageGroup: ageGroup(person.age),
      sex: person.sex === "MALE" ? "남성" : "여성",
    },
    domains: output.domains.map((d) => ({
      code: d.domain,
      name: domainContent[d.domain].label,
      status: statusContent[d.status].label,
      managementLevel: d.level,
      facts: d.findings.map(factOf).filter((x): x is string => !!x),
      currentlyManaged: d.managed,
    })),
    priorities: output.priorities.map((p) => ({
      rank: p.rank,
      code: p.domain,
      name: domainContent[p.domain].label,
      type: p.mode === "IMPROVE" ? "개선" : "유지",
      reasons: (byCode.get(p.domain)?.findings ?? [])
        .filter((f) => p.reasons.includes(f.messageKey))
        .map(factOf)
        .filter((x): x is string => !!x),
      relatedAreas: p.relatedDomains.map((r) => domainContent[r].label),
      orderNote: orderNoteFor(p, output.priorities, byCode),
    })),
  };
}
