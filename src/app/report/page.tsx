import { DomainStatusList } from "@/components/report/domain-status-list";
import { NoReport } from "@/components/report/no-report";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { domainContent } from "@/content/domains";
import { getLatestReport } from "@/features/analysis/queries";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "건강분석 결과 | 입체적 건강분석" };

export default async function ReportPage() {
  const user = await requireUser(routes.report);
  const report = await getLatestReport(user.id);
  if (!report) return <NoReport />;

  const byCode = new Map(report.domains.map((d) => [d.domain, d]));
  const texts = new Map(report.narrative.priorities.map((p) => [p.domain, p]));

  return (
    <>
      <PageHeader
        eyebrow="분석 결과"
        title={`${user.displayName}님의 건강관리 우선순위`}
        description={report.narrative.summary}
      />
      <ol className="flex flex-col gap-3">
        {report.priorities.map((p) => (
          <li key={p.domain}>
            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <span className="text-primary text-2xl font-bold">
                  {String(p.rank).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <p className="text-lg font-bold">
                    {domainContent[p.domain].label}
                  </p>
                  <p className="text-muted text-sm">
                    {p.mode === "MAINTAIN"
                      ? "좋은 상태 유지하기"
                      : domainContent[p.domain].short}
                  </p>
                </div>
                <StatusBadge status={byCode.get(p.domain)!.status} />
              </div>
              {texts.get(p.domain) && (
                <>
                  <p className="leading-relaxed">{texts.get(p.domain)!.why}</p>
                  <p className="bg-primary/5 rounded-xl px-4 py-3 text-sm leading-relaxed">
                    <span className="text-primary font-semibold">
                      이번 주 첫 실천 ·{" "}
                    </span>
                    {texts.get(p.domain)!.firstStep}
                  </p>
                </>
              )}
            </Card>
          </li>
        ))}
      </ol>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">나의 건강 프로파일</h2>
        <DomainStatusList domains={report.domains} />
        {report.dataGaps.length > 0 && (
          <p className="text-muted text-sm">
            {report.dataGaps.map((d) => domainContent[d].label).join(", ")}{" "}
            영역은 입력된 정보가 부족해 판단하지 않았어요.
          </p>
        )}
      </section>
      <Card className="bg-primary/5 border-primary/20 leading-relaxed">
        {report.narrative.encouragement}
      </Card>
      <p className="text-muted text-xs">
        {report.narrative.source === "template" ? "기본 설명" : "AI 설명"} ·
        분석 기준 {report.engineVersion} ·{" "}
        {report.analyzedAt.toLocaleDateString("ko-KR")}
      </p>
    </>
  );
}
