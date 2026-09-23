import { Card } from "@/components/ui/card";
import { statusContent } from "@/content/domains";
import type { DomainResult, DomainStatus } from "@/domain/analysis/types";

const ORDER: DomainStatus[] = [
  "MANAGEMENT_NEEDED",
  "ATTENTION",
  "NORMAL",
  "GOOD",
  "DATA_INSUFFICIENT",
];

/** 건강 한눈에 보기: 상태별 영역 수 + 요약 문장 */
export function HealthOverview({
  domains,
  summary,
}: {
  domains: DomainResult[];
  summary: string;
}) {
  const counts = ORDER.map((s) => ({
    status: s,
    count: domains.filter((d) => d.status === s).length,
  }));
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">건강 한눈에 보기</h2>
      <p className="leading-relaxed">{summary}</p>
      <ul
        className="grid grid-cols-5 gap-1.5 text-center"
        aria-label="상태별 영역 수"
      >
        {counts.map(({ status, count }) => {
          const s = statusContent[status];
          return (
            <li
              key={status}
              className={`rounded-xl border px-1 py-2 ${count ? s.tone : "border-border text-muted bg-background"}`}
            >
              <span aria-hidden className="block text-sm">
                {s.icon}
              </span>
              <span className="block text-xl font-bold">{count}</span>
              <span className="block text-[0.7rem] leading-tight">
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
