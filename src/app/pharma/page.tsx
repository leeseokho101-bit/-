import Link from "next/link";
import {
  countText,
  MonthlyBars,
  PersistenceChart,
} from "@/components/pharma/charts";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  persistenceNote,
  pharmaPrivacyNote,
  reasonLabels,
} from "@/content/pharma";
import { formatDose, getDrug } from "@/domain/glp1/drugs";
import { EARLY_AFTER_ESCALATION_WEEKS } from "@/domain/pharma/stats";
import {
  loadChannel,
  loadCourses,
  logPharmaAccess,
  persistenceView,
} from "@/features/pharma/service";
import { requirePharma } from "@/features/pharma/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "제약사 인사이트 포털 | GLP-1 케어" };

const pctText = (v: number | null) => (v === null ? "표본 부족" : `${v}%`);

export default async function PharmaPage({
  searchParams,
}: PageProps<"/pharma">) {
  const { member, today } = await requirePharma(routes.pharma);
  const sp = await searchParams;
  const drug =
    typeof sp.drug === "string" && member.drugCodes.includes(sp.drug)
      ? sp.drug
      : null;
  const [channel, courses] = await Promise.all([
    loadChannel(db, today),
    loadCourses(db, drug ? [drug] : member.drugCodes, today),
  ]);
  const { curve, dropout } = persistenceView(courses);
  await logPharmaAccess(db, member, "view-portal");
  const drugInfo = drug ? getDrug(drug) : null;

  return (
    <>
      <PageHeader
        eyebrow={`${member.orgName} · 제약사 인사이트 포털`}
        title="채널 현황과 지속 복용"
        description={`${today} 기준 · 모든 숫자는 집계 통계예요.`}
      />
      <p className="bg-primary/5 border-primary/20 rounded-xl border px-4 py-3 text-sm leading-relaxed">
        {pharmaPrivacyNote}
      </p>

      <section aria-labelledby="channel-title" className="flex flex-col gap-3">
        <h2 id="channel-title" className="text-lg font-bold">
          채널 현황
        </h2>
        <ul className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["참여 의원", channel.totals.clinics.toLocaleString()],
              ["등록 환자(동의)", countText(channel.totals.enrolledPatients)],
              ["최근 30일 활성", countText(channel.totals.activePatients)],
            ] as const
          ).map(([label, v]) => (
            <li
              key={label}
              className="border-border bg-surface rounded-xl border p-3"
            >
              <p className="text-muted text-sm">{label}</p>
              <p className="text-2xl font-bold">{v}</p>
            </li>
          ))}
        </ul>
        <Card>
          <MonthlyBars data={channel.monthly} />
        </Card>
        <div
          className="border-border bg-surface overflow-x-auto rounded-2xl border"
          tabIndex={0}
          role="region"
          aria-label="지역별 채널 현황 표"
        >
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">지역(시·도)</th>
                <th className="px-3 py-2 text-right font-medium">참여 의원</th>
                <th className="px-3 py-2 text-right font-medium">활성 의원</th>
                <th className="px-3 py-2 text-right font-medium">활성 환자</th>
              </tr>
            </thead>
            <tbody>
              {channel.regions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted px-3 py-3">
                    아직 참여 의원이 없어요.
                  </td>
                </tr>
              ) : (
                channel.regions.map((r) => (
                  <tr key={r.region} className="border-border border-t">
                    <td className="px-3 py-2">{r.region}</td>
                    <td className="px-3 py-2 text-right">{r.clinics}</td>
                    <td className="px-3 py-2 text-right">
                      {countText(r.activeClinics)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {countText(r.activePatients)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-muted text-xs">
          활성 = 최근 30일 안에 투약·체크인·식사 기록이 있고 치료 중단을
          기록하지 않은 환자
        </p>
      </section>

      <section
        aria-labelledby="persistence-title"
        className="flex flex-col gap-3"
      >
        <h2 id="persistence-title" className="text-lg font-bold">
          지속 복용 분석 (자사 제품)
        </h2>
        <nav aria-label="제품" className="flex flex-wrap gap-2">
          {[null, ...member.drugCodes].map((code) => {
            const active = code === drug;
            const info = code ? getDrug(code) : null;
            return (
              <Link
                key={code ?? "all"}
                href={code ? `${routes.pharma}?drug=${code}` : routes.pharma}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted"
                }`}
              >
                {info ? info.product : "자사 제품 전체"}
              </Link>
            );
          })}
        </nav>
        {!dropout || !curve ? (
          <Card className="text-muted text-sm">
            분석 대상이 10명 미만이라 결과를 보여드릴 수 없어요 (현재{" "}
            {courses.length < 5 ? "5명 미만" : `${courses.length}명`}).
          </Card>
        ) : (
          <>
            <Card>
              <PersistenceChart curve={curve} />
            </Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="flex flex-col gap-2">
                <h3 className="font-bold">용량 단계별 이탈</h3>
                <p className="text-muted text-xs">
                  분석 {dropout.cohort}명 · 중단 {countText(dropout.stopped)}명
                </p>
                <table className="w-full text-sm">
                  <thead className="text-muted text-xs">
                    <tr>
                      <th className="text-left font-medium">중단 시 용량</th>
                      <th className="text-right font-medium">중단</th>
                      <th className="text-right font-medium">
                        그 용량 유지(중앙값)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dropout.byStep.map((s) => (
                      <tr
                        key={s.step ?? "x"}
                        className="border-border border-t"
                      >
                        <td>
                          {s.step === null
                            ? "표준 단계 밖"
                            : drugInfo
                              ? `${s.step}단계 (${formatDose(drugInfo.doseSteps[s.step - 1])})`
                              : `${s.step}단계`}
                        </td>
                        <td className="text-right">{countText(s.count)}</td>
                        <td className="text-right">
                          {s.medianWeeksOnDose === null
                            ? "-"
                            : `${s.medianWeeksOnDose}주`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm">
                  증량 후 {EARLY_AFTER_ESCALATION_WEEKS}주 안에 중단:{" "}
                  <span className="font-semibold">
                    {pctText(dropout.earlyAfterEscalation)}
                  </span>
                  <span className="text-muted text-xs">
                    {" "}
                    (증량 후 중단한 환자 중)
                  </span>
                </p>
              </Card>
              <Card className="flex flex-col gap-2">
                <h3 className="font-bold">중단 사유</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {dropout.reasons.map((r) => (
                      <tr
                        key={r.reason}
                        className="border-border border-t first:border-t-0"
                      >
                        <td>{reasonLabels[r.reason]}</td>
                        <td className="text-right">{countText(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm">
                  중단 전 2주 안에 속 불편(보통 이상) 기록:{" "}
                  <span className="font-semibold">
                    {pctText(dropout.preStop.gi)}
                  </span>
                </p>
                <p className="text-sm">
                  중단 전 2주 안에 위험 신호:{" "}
                  <span className="font-semibold">
                    {pctText(dropout.preStop.alert)}
                  </span>
                </p>
              </Card>
            </div>
          </>
        )}
        <p className="text-muted text-xs leading-relaxed">{persistenceNote}</p>
      </section>
    </>
  );
}
