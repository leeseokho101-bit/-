import { NoReport } from "@/components/report/no-report";
import { PriorityCard } from "@/components/report/priority-card";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/page-header";
import { factOf } from "@/domain/narrative/input";
import { getLatestReport } from "@/features/analysis/queries";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "건강관리 우선순위 TOP 3 | 입체적 건강분석" };

export default async function PrioritiesPage() {
  const user = await requireUser(routes.reportPriorities);
  const report = await getLatestReport(user.id);
  if (!report) return <NoReport />;

  const byCode = new Map(report.domains.map((d) => [d.domain, d]));
  const texts = new Map(report.narrative.priorities.map((p) => [p.domain, p]));
  const maintainOnly = report.priorities.every((p) => p.mode === "MAINTAIN");

  return (
    <>
      <PageHeader
        eyebrow="지금 먼저 관리할 영역"
        title={
          maintainOnly
            ? "유지하면 좋은 건강습관 TOP 3"
            : "건강관리 우선순위 TOP 3"
        }
        description="검진 수치, 여러 지표의 동시 이상 여부, 생활습관, 입력 정보의 충분성을 함께 고려한 순서예요. 질병의 가능성을 뜻하지 않아요."
      />
      <ol className="flex flex-col gap-3">
        {report.priorities.map((p) => {
          const d = byCode.get(p.domain)!;
          const facts = d.findings
            .filter((f) => p.reasons.includes(f.messageKey))
            .map(factOf)
            .filter((x): x is string => !!x);
          return (
            <li key={p.domain}>
              <PriorityCard
                priority={p}
                domain={d}
                text={texts.get(p.domain)}
                facts={facts}
              />
            </li>
          );
        })}
      </ol>
      <ButtonLink href={routes.reportPlan}>이 순서로 12주 계획 보기</ButtonLink>
    </>
  );
}
