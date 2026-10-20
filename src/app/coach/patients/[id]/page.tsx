import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/coaching/auto-refresh";
import { Thread } from "@/components/coaching/thread";
import { Card } from "@/components/ui/card";
import { alertContent } from "@/content/care";
import { coachScopeNote } from "@/content/coaching";
import { proteinTarget, weeklyFeedbackDraft } from "@/domain/coaching/weekly";
import { formatDose } from "@/domain/glp1/drugs";
import { formatDateTime } from "@/features/care/format";
import { refreshAlerts } from "@/features/care/service";
import { CoachMessageForm, ReferralForm } from "@/features/coaching/forms";
import {
  getAssignedPatient,
  listThread,
  logCoachAccess,
  markRead,
  SUMMARY_DAYS,
  weekSummary,
} from "@/features/coaching/service";
import { requireCoach } from "@/features/coaching/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "환자 코칭 | 코칭 센터" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background flex flex-col rounded-xl px-3 py-2">
      <span className="text-muted text-xs">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export default async function CoachPatientPage({
  params,
}: PageProps<"/coach/patients/[id]">) {
  const { id } = await params;
  const { coach, today, now } = await requireCoach(routes.coach);
  const patient = await getAssignedPatient(db, coach, id);
  if (!patient) notFound();
  await logCoachAccess(db, coach, "view-patient", id);
  const [summary, alerts] = await Promise.all([
    weekSummary(db, patient, today, now),
    refreshAlerts(db, id, today),
  ]);
  const messages = await listThread(db, id);
  const hasMedicationQuestion = messages.some(
    (m) => m.sender === "PATIENT" && m.medicationQuestion && !m.readAt,
  );
  await markRead(db, id, "COACH");
  const target = proteinTarget(summary.latestWeightKg);

  return (
    <>
      <Link
        href={routes.coach}
        className="text-primary text-sm font-semibold underline"
      >
        ← 담당 환자
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{patient.displayName}</h1>
        <p className="text-muted text-sm">
          {patient.drug.ingredient} · {formatDose(patient.doseMg)} · 첫 투약{" "}
          {patient.startDate}
          {patient.clinic ? ` · ${patient.clinic.name}` : " · 연결된 의원 없음"}
        </p>
      </header>

      {alerts.length > 0 && (
        <section
          role="alert"
          className="flex flex-col gap-1 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950"
        >
          <h2 className="font-bold">⚠ 최근 위험 신호</h2>
          <ul className="list-disc pl-5">
            {alerts.map((a) => (
              <li key={a.kind}>
                {alertContent[a.kind]} ({formatDateTime(a.detectedAt)})
              </li>
            ))}
          </ul>
          <p className="text-xs">
            환자 앱에 의원 연락 안내가 표시되고 있어요. 필요하면 아래에서 의원
            확인을 요청하세요.
          </p>
        </section>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-bold">최근 {SUMMARY_DAYS}일 요약</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="체크인"
            value={`${summary.checkInDays}/${summary.days}일`}
          />
          <Stat
            label="식사 기록"
            value={`${summary.mealCount}끼 (${summary.mealDays}일)`}
          />
          <Stat
            label="하루 단백질"
            value={
              summary.avgProteinPerDay === null
                ? "-"
                : `${summary.avgProteinPerDay}g${target ? ` / 목표 ${target}g` : ""}`
            }
          />
          <Stat
            label="평균 식욕"
            value={
              summary.avgAppetite === null ? "-" : `${summary.avgAppetite}/10`
            }
          />
          <Stat
            label="속 불편(보통 이상)"
            value={`${summary.giModerateDays}일`}
          />
          <Stat
            label="체중 변화"
            value={
              summary.weightChange === null
                ? "-"
                : `${summary.weightChange > 0 ? "+" : ""}${summary.weightChange}kg`
            }
          />
          <Stat
            label="혈당 목표 범위"
            value={summary.tir === null ? "-" : `${summary.tir}%`}
          />
          <Stat
            label="평균 식후 상승"
            value={
              summary.avgMealRise === null ? "-" : `+${summary.avgMealRise}`
            }
          />
        </div>
        <p className="text-muted text-xs">
          4주 복용률{" "}
          {summary.adherenceRate === null
            ? "-"
            : `${Math.round(summary.adherenceRate * 100)}%`}{" "}
          — 투약 관련 내용은 코칭하지 않고 필요하면 의원 확인을 요청해 주세요.
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-bold">대화</h2>
        <Thread
          messages={messages}
          viewer="COACH"
          names={{ PATIENT: patient.displayName, COACH: "코치" }}
        />
        <CoachMessageForm
          patientId={id}
          draft={weeklyFeedbackDraft(patient.displayName, summary)}
          hasMedicationQuestion={hasMedicationQuestion}
        />
        <p className="text-muted text-xs leading-relaxed">{coachScopeNote}</p>
      </Card>

      <details className="border-border bg-surface rounded-2xl border p-5">
        <summary className="cursor-pointer font-semibold">
          담당 의원에 확인 요청 (에스컬레이션)
        </summary>
        <p className="text-muted mt-3 mb-3 text-sm leading-relaxed">
          약·용량 문의, 계속되는 증상, 저혈당이 의심되는 상황처럼 코칭 범위를
          넘는 경우에 쓰세요. 환자가 의원 공유에 동의했다면 의사 대시보드에
          표시돼요.
        </p>
        <ReferralForm patientId={id} />
      </details>
      <AutoRefresh seconds={30} />
    </>
  );
}
