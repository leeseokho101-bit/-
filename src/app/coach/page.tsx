import Link from "next/link";
import { buttonBase } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { coachScopeNote, specialtyLabels } from "@/content/coaching";
import { formatDateTime, formatDay } from "@/features/care/format";
import { claimPatientAction } from "@/features/coaching/actions";
import {
  coachInbox,
  logCoachAccess,
  WEEKLY_FEEDBACK_TARGET,
} from "@/features/coaching/service";
import { requireCoach } from "@/features/coaching/session";
import { coachPatientPath, routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "코칭 센터 | GLP-1 케어" };

export default async function CoachInboxPage() {
  const { coach, today, now } = await requireCoach(routes.coach);
  const { rows, unassigned } = await coachInbox(db, coach, today, now);
  await logCoachAccess(db, coach, "view-inbox");
  const needsReply = rows.filter((r) => r.unread > 0).length;
  const noFeedback = rows.filter(
    (r) => r.coachMessagesThisWeek < WEEKLY_FEEDBACK_TARGET,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow={`코칭 센터 · ${specialtyLabels[coach.specialty]} ${coach.displayName}`}
        title="담당 환자"
        description="답장이 필요한 환자와 위험 신호가 있는 환자가 위에 보여요."
      />
      <p className="bg-primary/5 border-primary/20 rounded-xl border px-4 py-3 text-sm leading-relaxed">
        {coachScopeNote}
      </p>

      <ul className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["담당 환자", rows.length],
            ["답장 필요", needsReply],
            ["이번 주 피드백 전", noFeedback],
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

      <section aria-labelledby="inbox-title" className="flex flex-col gap-3">
        <h2 id="inbox-title" className="text-lg font-bold">
          대화
        </h2>
        {rows.length === 0 ? (
          <Card className="text-muted text-sm">아직 담당 환자가 없어요.</Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.patientId}>
                <Link
                  href={coachPatientPath(r.patientId)}
                  className="border-border bg-surface hover:bg-background flex flex-col gap-1 rounded-xl border p-4"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.displayName}</span>
                    {r.unread > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 text-xs font-bold">
                        새 메시지 {r.unread}
                      </span>
                    )}
                    {r.medicationQuestion && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-semibold text-amber-900">
                        약 관련 문의
                      </span>
                    )}
                    {r.openAlerts > 0 && (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 text-xs font-semibold text-rose-900">
                        ⚠ 위험 신호 {r.openAlerts}
                      </span>
                    )}
                    <span
                      className={`ml-auto text-xs ${r.coachMessagesThisWeek >= WEEKLY_FEEDBACK_TARGET ? "text-muted" : "font-semibold text-rose-800"}`}
                    >
                      이번 주 피드백 {r.coachMessagesThisWeek}회
                    </span>
                  </span>
                  <span className="text-muted line-clamp-1 text-sm">
                    {r.lastMessage
                      ? `${r.lastMessage.sender === "COACH" ? "나: " : r.lastMessage.sender === "SYSTEM" ? "안내: " : ""}${r.lastMessage.body}`
                      : "아직 대화 없음"}
                  </span>
                  <span className="text-muted text-xs">
                    {r.lastMessage
                      ? `${formatDateTime(r.lastMessage.at)} · `
                      : ""}
                    최근 체크인{" "}
                    {r.lastCheckIn ? formatDay(r.lastCheckIn) : "없음"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unassigned.length > 0 && (
        <section
          aria-labelledby="unassigned-title"
          className="flex flex-col gap-3"
        >
          <h2 id="unassigned-title" className="text-lg font-bold">
            미배정 환자 ({unassigned.length}명)
          </h2>
          <ul className="flex flex-col gap-2">
            {unassigned.map((u) => (
              <li
                key={u.patientId}
                className="border-border bg-surface flex items-center justify-between gap-2 rounded-xl border px-4 py-3"
              >
                <span>
                  <span className="font-semibold">{u.displayName}</span>
                  <span className="text-muted block text-xs">
                    첫 투약 {formatDay(u.startDate)}
                  </span>
                </span>
                <form action={claimPatientAction}>
                  <input type="hidden" name="patientId" value={u.patientId} />
                  <button
                    type="submit"
                    className={`${buttonBase} border-border bg-surface border text-sm`}
                  >
                    내가 맡기
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
