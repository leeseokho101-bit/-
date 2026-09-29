import {
  BioAgeSummary,
  MedicationBreakdown,
  MetabolicSection,
  OrganAgeCard,
} from "@/components/report/bio-age";
import { NoReport } from "@/components/report/no-report";
import { ReportFootnote } from "@/components/report/report-footnote";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { bioAgeDisclaimer, referenceSourceText } from "@/content/bio-age";
import { getLatestReport } from "@/features/analysis/queries";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "생체나이 | 입체적 건강분석" };

export default async function BioAgePage() {
  const user = await requireUser(routes.reportBioAge);
  const report = await getLatestReport(user.id);
  if (!report) return <NoReport />;

  const header = (
    <PageHeader
      eyebrow="건강검진 수치로 본"
      title="나의 생체나이"
      description="간·혈관·혈압·신장·당뇨·빈혈 수치를 같은 성별·나이 평균과 비교해 나이로 바꿔 봤어요. 혈압약·당뇨약·고지혈증약은 성분·용량에 따라 평균적인 효과를 반영해 보정해요."
    />
  );

  const bio = report.bioAge;
  if (!bio) {
    return (
      <>
        {header}
        <Card className="flex flex-col gap-3 text-center">
          <p className="font-semibold">
            생체나이는 새로 분석한 결과부터 볼 수 있어요
          </p>
          <p className="text-muted text-sm">
            건강분석을 다시 진행하면 생체나이를 계산해 드려요.
          </p>
          <ButtonLink href={routes.assessment}>다시 분석하기</ButtonLink>
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <BioAgeSummary result={bio} />
      <section className="flex flex-col gap-3" aria-labelledby="organs-title">
        <h2 id="organs-title" className="text-lg font-bold">
          영역별 생체나이
        </h2>
        {bio.organs
          .filter((o) => o.organ !== "METABOLIC")
          .map((o) => (
            <OrganAgeCard key={o.organ} organ={o} />
          ))}
      </section>
      <MetabolicSection result={bio} />
      <MedicationBreakdown result={bio} />
      <p className="text-muted bg-surface border-border rounded-xl border p-3 text-xs leading-relaxed">
        {bioAgeDisclaimer}
        <br />
        {referenceSourceText()}
      </p>
      <ReportFootnote report={{ ...report, engineVersion: bio.version }} />
    </>
  );
}
