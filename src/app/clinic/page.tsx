import Link from "next/link";
import { FlagBadge } from "@/components/clinic/flag-badge";
import { buttonBase } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  alertLabels,
  levelLabels,
  reasonText,
  roleLabels,
  durationText,
} from "@/content/clinic";
import { formatDose } from "@/domain/glp1/drugs";
import { daysBetween } from "@/domain/glp1/time";
import { formatDateTime, formatDay } from "@/features/care/format";
import { acknowledgeAlertsAction } from "@/features/clinic/actions";
import { listClinicPatients, logAccess } from "@/features/clinic/service";
import { requireClinician } from "@/features/clinic/session";
import { clinicPatientPath, routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "의사 대시보드 | GLP-1 케어" };

function visitText(next: string | null, today: string): string {
  if (!next) return "미정";
  const d = daysBetween(today, next);
  return d === 0
    ? "오늘"
    : d < 0
      ? `${formatDay(next)} (지남)`
      : `${formatDay(next)} · D-${d}`;
}

export default async function ClinicPage() {
  const { staff, today, now } = await requireClinician(routes.clinic);
  const { patients, alerts } = await listClinicPatients(
    db,
    staff.clinicId,
    today,
    now,
  );
  await logAccess(db, staff, "view-list");
  const alertPatients = [
    ...new Map(alerts.map((a) => [a.patientId, a])).values(),
  ];
  const counts = {
    ALERT: patients.filter((p) => p.flag === "ALERT").length,
    WATCH: patients.filter((p) => p.flag === "WATCH").length,
    today: patients.filter((p) => p.nextVisitOn === today).length,
  };

  return (
    <>
      <PageHeader
        eyebrow={`${staff.clinicName} · ${roleLabels[staff.role]}`}
        title="GLP-1 케어 환자"
        description="담당 의원 공유에 동의한 환자만 보여요. 다음 내원일 순으로 정렬돼요."
      />

      <ul className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["오늘 내원", counts.today],
            ["확인 필요", counts.ALERT],
            ["관찰", counts.WATCH],
          ] as const
        ).map(([label, n]) => (
          <li
            key={label}
            className="border-border bg-surface rounded-xl border p-3"
          >
            <p className="text-muted text-sm">{label}</p>
            <p className="text-2xl font-bold">{n}</p>
          </li>
        ))}
      </ul>

      {alertPatients.length > 0 && (
        <section aria-labelledby="alerts-title" className="flex flex-col gap-3">
          <h2 id="alerts-title" className="text-lg font-bold">
            ⚠ 확인하지 않은 이상 알림
          </h2>
          <ul className="flex flex-col gap-2">
            {alertPatients.map((first) => {
              const mine = alerts.filter(
                (a) => a.patientId === first.patientId,
              );
              return (
                <li
                  key={first.patientId}
                  className="flex flex-col gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <Link
                      href={clinicPatientPath(first.patientId)}
                      className="font-bold underline"
                    >
                      {first.displayName}
                    </Link>
                    <ul className="text-sm">
                      {mine.map((a) => (
                        <li key={a.id}>
                          {alertLabels[a.kind]}
                          {a.detail && `(${a.detail})`} · {levelLabels[a.level]}{" "}
                          · {formatDateTime(a.detectedAt)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <form action={acknowledgeAlertsAction}>
                    <input
                      type="hidden"
                      name="patientId"
                      value={first.patientId}
                    />
                    <button
                      type="submit"
                      className={`${buttonBase} border border-rose-300 bg-white text-sm text-rose-900`}
                    >
                      확인 처리
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="patients-title" className="flex flex-col gap-3">
        <h2 id="patients-title" className="text-lg font-bold">
          환자 목록 ({patients.length}명)
        </h2>
        {patients.length === 0 ? (
          <Card className="text-muted text-sm leading-relaxed">
            아직 연결된 환자가 없어요. 처방할 때 의원 연결 코드가 적힌 등록
            카드를 전달해 주세요.
          </Card>
        ) : (
          <div
            className="border-border bg-surface overflow-x-auto rounded-2xl border"
            tabIndex={0}
            role="region"
            aria-label="환자 목록 표"
          >
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">환자</th>
                  <th className="px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">다음 내원</th>
                  <th className="px-3 py-2 font-medium">현재 용량</th>
                  <th className="px-3 py-2 text-right font-medium">
                    4주 복용률
                  </th>
                  <th className="px-3 py-2 font-medium">최근 체크인</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr
                    key={p.patientId}
                    className="border-border border-t align-top"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={clinicPatientPath(p.patientId)}
                        className="text-primary font-semibold underline"
                      >
                        {p.displayName}
                      </Link>
                      {p.chartNo && (
                        <span className="text-muted block text-xs">
                          #{p.chartNo}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <FlagBadge flag={p.flag} />
                      {p.stoppedOn && (
                        <span className="mt-1 block text-xs font-semibold">
                          치료 중단 기록 ({formatDay(p.stoppedOn)})
                        </span>
                      )}
                      {p.reasons.length > 0 && (
                        <span className="text-muted mt-1 block text-xs">
                          {p.reasons.map(reasonText).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {visitText(p.nextVisitOn, today)}
                    </td>
                    <td className="px-3 py-2">
                      {formatDose(p.doseMg)}
                      <span className="text-muted block text-xs">
                        {p.drug.ingredient} · {durationText(p.daysOnDose)}째
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.adherence28 === null
                        ? "-"
                        : `${Math.round(p.adherence28 * 100)}%`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.lastCheckIn ? formatDay(p.lastCheckIn) : "없음"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
