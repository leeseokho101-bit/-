import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { domainContent } from "@/content/domains";
import type { DomainResult, PriorityItem } from "@/domain/analysis/types";
import type { Narrative } from "@/domain/narrative/types";
import { routes } from "@/lib/routes";

type Props = {
  priority: PriorityItem;
  domain: DomainResult;
  text?: Narrative["priorities"][number];
  /** 판단 근거 문장 (상세 보기) */
  facts?: string[];
  compact?: boolean;
};

export function PriorityCard({
  priority: p,
  domain,
  text,
  facts,
  compact,
}: Props) {
  const c = domainContent[p.domain];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span
          className="text-primary text-2xl font-bold"
          aria-label={`${p.rank}순위`}
        >
          {String(p.rank).padStart(2, "0")}
        </span>
        <div className="flex-1">
          <p className="text-lg font-bold">{c.label}</p>
          <p className="text-muted text-sm">
            {p.mode === "MAINTAIN" ? "좋은 상태 유지하기" : c.short}
          </p>
        </div>
        <StatusBadge status={domain.status} />
      </div>
      {text && (
        <p className="leading-relaxed">
          {compact ? firstSentence(text.why) : text.why}
        </p>
      )}
      {!compact && facts && facts.length > 0 && (
        <div>
          <p className="text-muted mb-1 text-sm font-semibold">판단 근거</p>
          <ul className="text-muted flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && p.relatedDomains.length > 0 && (
        <p className="text-sm">
          <span className="text-muted">함께 좋아질 수 있는 영역 · </span>
          {p.relatedDomains.map((r) => domainContent[r].label).join(", ")}
        </p>
      )}
      {text && (
        <p className="bg-primary/5 rounded-xl px-4 py-3 text-sm leading-relaxed">
          <span className="text-primary font-semibold">이번 주 첫 실천 · </span>
          {text.firstStep}
        </p>
      )}
      {compact && (
        <Link
          href={routes.reportPriorities}
          className="text-primary self-end text-sm font-semibold underline"
        >
          자세히 보기
        </Link>
      )}
    </Card>
  );
}

function firstSentence(text: string): string {
  const m = text.match(/^.+?[.!?요다](\s|$)/);
  return m ? m[0].trim() : text;
}
