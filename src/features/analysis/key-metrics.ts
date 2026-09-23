import { keyMetricGuides } from "@/content/bands";
import type { Band, DomainResult } from "@/domain/analysis/types";
import { METRICS, type MetricCode } from "@/domain/health-snapshot/metrics";

export type KeyMetric = {
  item: string;
  label: string;
  value: string;
  band: Band;
  guide: string;
};

/** 판정 근거(findings)에서 주요 건강 데이터를 뽑는다 — 판정은 엔진 결과 그대로 */
export function buildKeyMetrics(
  domains: DomainResult[],
  sex: "MALE" | "FEMALE",
): KeyMetric[] {
  const findings = new Map<string, DomainResult["findings"][number]>();
  for (const d of domains) {
    for (const f of d.findings)
      if (!findings.has(f.item)) findings.set(f.item, f);
  }
  return keyMetricGuides.flatMap(({ item, label, guide }) => {
    const f = findings.get(item);
    if (!f) return [];
    const unit =
      item === "BP" ? "mmHg" : (METRICS[item as MetricCode]?.unit ?? "");
    return [
      {
        item,
        label,
        value: `${f.value}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`,
        band: f.band,
        guide: typeof guide === "string" ? guide : guide[sex],
      },
    ];
  });
}
