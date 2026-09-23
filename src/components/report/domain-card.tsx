import Link from "next/link";
import { BandBadge } from "@/components/ui/band-badge";
import { LevelDots, StatusBadge } from "@/components/ui/status-badge";
import { domainContent } from "@/content/domains";
import type { DomainResult } from "@/domain/analysis/types";
import { factOf } from "@/domain/narrative/input";
import { routes } from "@/lib/routes";

/** 나의 건강 프로파일 카드 — 의미(상태·설명)를 먼저, 숫자(근거)는 펼쳐서 */
export function DomainCard({
  domain: d,
  explanation,
}: {
  domain: DomainResult;
  explanation?: string;
}) {
  const c = domainContent[d.domain];
  // 대사건강의 요소별 근거(점수 0)는 요약 1개로 충분하므로 요약 + 해당 요소만 표시
  const findings = d.findings.filter(
    (f) =>
      !(
        d.domain === "METABOLIC" &&
        f.item !== "metabolic.count" &&
        f.band === "OPTIMAL"
      ),
  );
  return (
    <article className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{c.label}</h3>
          <p className="text-muted text-xs">{c.short}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={d.status} />
          <LevelDots level={d.level} />
        </div>
      </header>
      {d.managed && (
        <p className="bg-background text-muted self-start rounded-md px-2 py-0.5 text-xs">
          복용 목적상 현재 관리 중인 항목이 있어요
        </p>
      )}
      {explanation && <p className="leading-relaxed">{explanation}</p>}
      {d.status === "DATA_INSUFFICIENT" ? (
        <Link
          href={routes.assessment}
          className="text-primary text-sm font-semibold underline"
        >
          정보 입력하고 다시 분석하기
        </Link>
      ) : (
        findings.length > 0 && (
          <details className="group">
            <summary className="text-primary cursor-pointer list-none text-sm font-semibold">
              <span className="group-open:hidden">판단 근거 보기 ▾</span>
              <span className="hidden group-open:inline">판단 근거 접기 ▴</span>
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {findings.map((f) => {
                const text = factOf(f);
                return text ? (
                  <li
                    key={f.messageKey + f.item}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="leading-relaxed">{text}</span>
                    <BandBadge band={f.band} />
                  </li>
                ) : null;
              })}
            </ul>
          </details>
        )
      )}
      <p className="text-muted text-xs">
        입력 충족률 {Math.round(d.completeness * 100)}%
      </p>
    </article>
  );
}
