import { LevelDots, StatusBadge } from "@/components/ui/status-badge";
import { domainContent } from "@/content/domains";
import type { DomainCode, DomainResult } from "@/domain/analysis/types";

/** 10개 영역 상태 목록 (STEP 8에서 카드형 프로파일로 확장) */
export function DomainStatusList({
  domains,
  explanations,
}: {
  domains: DomainResult[];
  explanations?: Partial<Record<DomainCode, string>>;
}) {
  return (
    <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
      {domains.map((d) => (
        <li key={d.domain} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{domainContent[d.domain].label}</p>
              <p className="text-muted text-xs">
                {domainContent[d.domain].short}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={d.status} />
              <LevelDots level={d.level} />
            </div>
          </div>
          {explanations?.[d.domain] && (
            <p className="text-muted text-sm leading-relaxed">
              {explanations[d.domain]}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
