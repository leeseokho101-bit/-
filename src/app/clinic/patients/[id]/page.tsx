import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RangeBar } from "@/components/care/range-bar";
import { AgpChart } from "@/components/clinic/agp-chart";
import { PrintButton } from "@/components/clinic/print-button";
import { buttonBase } from "@/components/ui/button-link";
import { siteLabels, symptomLabels } from "@/content/care";
import {
  alertLabels,
  clinicReportNote,
  levelLabels,
  referenceNote,
  durationText,
} from "@/content/clinic";
import { TIR_TARGETS } from "@/domain/glp1/cgm";
import { doseStepNumber, formatDose } from "@/domain/glp1/drugs";
import { SYMPTOMS } from "@/domain/glp1/symptoms";
import { daysBetween } from "@/domain/glp1/time";
import { formatDateTime, formatDay } from "@/features/care/format";
import {
  acknowledgeAlertsAction,
  recordVisitAction,
} from "@/features/clinic/actions";
import { ClinicFieldsForm } from "@/features/clinic/clinic-fields-form";
import {
  getPatientReport,
  logAccess,
  REPORT_GLUCOSE_DAYS,
} from "@/features/clinic/service";
import { requireClinician } from "@/features/clinic/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "내원 전 리포트 | 의사 대시보드" };

const pct = (r: number | null) =>
  r === null ? "-" : `${Math.round(r * 100)}%`;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-surface flex break-inside-avoid flex-col gap-2 rounded-2xl border p-4 print:rounded-none print:p-2">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export default async function ClinicPatientPage({
  params,
}: PageProps<"/clinic/patients/[id]">) {
  const { id } = await params;
  const { staff, today, now } = await requireClinician(routes.clinic);
  const report = await getPatientReport(db, staff.clinicId, id, today, now);
  if (!report) notFound();
  await logAccess(db, staff, "view-report", id);
  const { patient: p, period, glucose: g, symptoms: s, symptoms14 } = report;
  const step = doseStepNumber(p.drug, p.doseMg);
  const openAlerts = report.alerts.filter((a) => !a.acknowledgedAt);
  const doseChanges = report.doses
    .filter((d) => d.status === "TAKEN")
    .reverse()
    .filter((d, i, arr) => i === 0 || arr[i - 1].doseMg !== d.doseMg);

  return (
    <>
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={routes.clinic}
          className="text-primary text-sm font-semibold underline"
        >
          ← 환자 목록
        </Link>
        <PrintButton />
      </div>

      <header className="flex flex-col gap-1">
        <p className="text-primary text-sm font-semibold">
          {staff.clinicName} · 내원 전 1장 리포트
        </p>
        <h1 className="text-2xl font-bold">
          {p.displayName}
          {p.chartNo && (
            <span className="text-muted ml-2 text-base">#{p.chartNo}</span>
          )}
        </h1>
        <p className="text-sm">
          {p.drug.ingredient}({p.drug.product}) · 현재 {formatDose(p.doseMg)}
          {step ? ` (${step}단계)` : ""} · 이 용량{" "}
          {durationText(report.daysOnDose)}째 · 첫 투약 {p.startDate}
        </p>
        <p className="text-muted text-sm">
          기간:{" "}
          {period.sinceVisit
            ? `지난 내원(${formatDay(period.sinceVisit)}) 이후`
            : "첫 투약 이후"}{" "}
          {formatDay(period.from)} ~ {formatDay(period.to)} (
          {daysBetween(period.from, period.to) + 1}일)
          {p.nextVisitOn && ` · 다음 내원 ${formatDay(p.nextVisitOn)}`}
        </p>
      </header>

      {report.alerts.length > 0 && (
        <section
          className={`flex flex-col gap-2 rounded-2xl border p-4 ${
            openAlerts.length
              ? "border-rose-300 bg-rose-50 text-rose-950"
              : "border-border bg-surface"
          }`}
          aria-labelledby="report-alerts"
        >
          <h2 id="report-alerts" className="font-bold">
            이상 알림 (기간 내 {report.alerts.length}건, 미확인{" "}
            {openAlerts.length}건)
          </h2>
          <ul className="flex flex-col gap-0.5 text-sm">
            {report.alerts.map((a) => (
              <li key={a.id}>
                {a.acknowledgedAt ? "✓" : "⚠"} {alertLabels[a.kind]} ·{" "}
                {levelLabels[a.level]} · {formatDateTime(a.detectedAt)}
                {a.acknowledgedAt && (
                  <span className="text-muted"> (확인함)</span>
                )}
              </li>
            ))}
          </ul>
          {openAlerts.length > 0 && (
            <form action={acknowledgeAlertsAction} className="print:hidden">
              <input type="hidden" name="patientId" value={id} />
              <button
                type="submit"
                className={`${buttonBase} border border-rose-300 bg-white text-sm text-rose-900`}
              >
                모두 확인 처리
              </button>
            </form>
          )}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        <Block title="참고 지표 (증량 판단 참고)">
          <dl className="flex flex-col gap-1">
            <Row
              label="현재 용량 유지"
              value={`${formatDose(p.doseMg)} · ${durationText(report.daysOnDose)}`}
            />
            <Row
              label="최근 4주 복용률"
              value={`${pct(report.adherence.last28.rate)} (${report.adherence.last28.taken}/${report.adherence.last28.expected}회)`}
            />
            <Row
              label="최근 14일 위장관 증상 보통 이상"
              value={`${symptoms14.giModerateDays}일 / 체크인 ${symptoms14.checkInDays}일`}
            />
            <Row
              label={`최근 ${REPORT_GLUCOSE_DAYS}일 목표 범위(70–180)`}
              value={g.last14 ? `${g.last14.pct.IN_RANGE}%` : "-"}
            />
            <Row
              label="기간 체중 변화"
              value={
                report.weight
                  ? `${report.weight.change > 0 ? "+" : ""}${report.weight.change}kg (${report.weight.changePct}%)`
                  : "-"
              }
            />
          </dl>
          <p className="text-muted text-xs leading-relaxed">{referenceNote}</p>
        </Block>

        <Block title="체중">
          {report.weight ? (
            <dl className="flex flex-col gap-1">
              <Row
                label={`처음 (${formatDay(report.weight.first.date)})`}
                value={`${report.weight.first.kg}kg`}
              />
              <Row
                label={`최근 (${formatDay(report.weight.last.date)})`}
                value={`${report.weight.last.kg}kg`}
              />
              <Row
                label="변화"
                value={`${report.weight.change > 0 ? "+" : ""}${report.weight.change}kg (${report.weight.changePct}%)`}
              />
              <Row
                label="기록 횟수"
                value={`${report.weight.points.length}회`}
              />
            </dl>
          ) : (
            <p className="text-muted text-sm">
              기간 안 체중 기록이 2회 미만이에요.
            </p>
          )}
        </Block>

        <Block title={`혈당 · 최근 ${REPORT_GLUCOSE_DAYS}일 AGP`}>
          {g.last14 ? (
            <>
              <AgpChart hours={g.agp} />
              <RangeBar pct={g.last14.pct} />
              <dl className="flex flex-col gap-1">
                <Row
                  label="평균 / GMI"
                  value={`${g.last14.mean} mg/dL / ${g.last14.gmi}%`}
                />
                <Row
                  label="변동계수(CV)"
                  value={`${g.last14.cv}% (참고 ≤${TIR_TARGETS.cvMax}%)`}
                />
                <Row label="측정된 시간" value={`${g.last14.coveragePct}%`} />
                <Row
                  label="기간 내 <70 구간 (<54)"
                  value={`${g.lows.length}회 (${g.lows.filter((l) => l.level === 2).length}회)`}
                />
                {g.period && (
                  <Row
                    label="기간 전체 목표 범위"
                    value={`${g.period.pct.IN_RANGE}%`}
                  />
                )}
              </dl>
            </>
          ) : (
            <p className="text-muted text-sm">
              최근 {REPORT_GLUCOSE_DAYS}일 CGM 기록이 없어요.
            </p>
          )}
        </Block>

        <Block title="부작용 체크인">
          <p className="text-muted text-xs">
            체크인 {s.checkInDays}일 / 기간 {s.periodDays}일 · 평균 식욕{" "}
            {s.avgAppetite ?? "-"}/10 · 의원 연락·즉시 진료 안내{" "}
            {s.escalatedDays}일
          </p>
          <table className="w-full text-sm">
            <thead className="text-muted text-xs">
              <tr>
                <th className="text-left font-medium">증상</th>
                <th className="text-right font-medium">있었던 날</th>
                <th className="text-right font-medium">보통 이상</th>
                <th className="text-right font-medium">최고</th>
              </tr>
            </thead>
            <tbody>
              {SYMPTOMS.map((c) => (
                <tr key={c} className="border-border border-t">
                  <td>{symptomLabels[c]}</td>
                  <td className="text-right">{s.bySymptom[c].days}</td>
                  <td className="text-right">{s.bySymptom[c].moderateDays}</td>
                  <td className="text-right">{s.bySymptom[c].max}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted text-xs">정도: 1 약간 · 2 보통 · 3 심함</p>
        </Block>

        <Block title="복용">
          <dl className="flex flex-col gap-1">
            <Row
              label="기간 복용률"
              value={`${pct(report.adherence.period.rate)} (${report.adherence.period.taken}/${report.adherence.period.expected}회)`}
            />
            <Row
              label="놓침으로 기록"
              value={`${report.adherence.period.missedRecorded}회`}
            />
            {doseChanges.length > 1 && (
              <Row
                label="기간 내 용량"
                value={doseChanges.map((d) => formatDose(d.doseMg)).join(" → ")}
              />
            )}
          </dl>
          <ul className="text-xs">
            {report.doses.slice(0, 12).map((d) => (
              <li
                key={d.id}
                className="border-border flex justify-between border-t py-0.5"
              >
                <span>{formatDateTime(d.takenAt)}</span>
                <span>
                  {d.status === "TAKEN"
                    ? `${formatDose(d.doseMg)}${d.site ? ` · ${siteLabels[d.site]}` : ""}`
                    : "놓침"}
                </span>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="식사">
          <dl className="flex flex-col gap-1">
            <Row label="기록한 식사" value={`${report.meals.count}끼`} />
            <Row
              label="하루 평균 단백질 (기록한 날)"
              value={
                report.meals.avgProteinPerDay === null
                  ? "-"
                  : `${report.meals.avgProteinPerDay}g`
              }
            />
            <Row
              label="평균 식후 혈당 상승"
              value={
                report.meals.avgRise === null
                  ? "-"
                  : `+${report.meals.avgRise} mg/dL`
              }
            />
          </dl>
        </Block>
      </div>

      <p className="text-muted text-xs leading-relaxed">{clinicReportNote}</p>

      <section
        className="border-border bg-surface flex flex-col gap-4 rounded-2xl border p-4 print:hidden"
        aria-labelledby="clinic-actions"
      >
        <h2 id="clinic-actions" className="font-bold">
          의원 기록
        </h2>
        <form action={recordVisitAction}>
          <input type="hidden" name="patientId" value={id} />
          <button
            type="submit"
            className={`${buttonBase} bg-primary text-primary-foreground w-full`}
          >
            오늘 진료 완료로 기록 (다음 리포트는 오늘 이후부터)
          </button>
        </form>
        <ClinicFieldsForm
          patientId={id}
          nextVisitOn={p.nextVisitOn}
          chartNo={p.chartNo}
          today={today}
        />
      </section>
    </>
  );
}
