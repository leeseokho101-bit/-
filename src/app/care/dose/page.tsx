import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { careDisclaimer, siteLabels } from "@/content/care";
import {
  doseSchedule,
  missedDoseCount,
  suggestNextSite,
} from "@/domain/glp1/dosing";
import { formatDose } from "@/domain/glp1/drugs";
import { addDaysIso, kstTime } from "@/domain/glp1/time";
import { deleteDoseAction } from "@/features/care/actions";
import { CurrentDoseForm, DoseForm } from "@/features/care/dose-forms";
import { dueText, formatDateTime } from "@/features/care/format";
import { CARE_EDITABLE_DAYS } from "@/features/care/schemas";
import { TreatmentStopForm } from "@/features/care/stop-form";
import { listDoses } from "@/features/care/service";
import { requireEnrollment } from "@/features/care/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "투약 기록 | GLP-1 케어" };

const HISTORY = 12;

export default async function CareDosePage() {
  const {
    user,
    enrollment: e,
    today,
    now,
  } = await requireEnrollment(routes.careDose);
  const doses = await listDoses(db, user.id);
  const schedule = doseSchedule(e.drug, e.startDate, doses, today);
  const missed = missedDoseCount(e.drug, e.startDate, doses, today);

  return (
    <>
      <PageHeader
        title="투약 기록"
        description={`${e.drug.ingredient} · ${e.drug.product} · ${e.drug.intervalDays === 7 ? "주 1회" : "매일"} · 현재 처방 ${formatDose(e.doseMg)}`}
      />

      <Card className="flex flex-col gap-1">
        <p
          className={`text-lg font-bold ${schedule.daysUntil < 0 ? "text-rose-800" : ""}`}
        >
          {dueText(schedule.daysUntil)}
        </p>
        <p className="text-muted text-sm">
          다음 예정일 {schedule.nextDue}
          {schedule.lastTaken && ` · 마지막 투약 ${schedule.lastTaken}`}
          {missed > 0 && ` · 최근 4주 놓침 ${missed}회`}
        </p>
        <a
          href={`${routes.careDose}/reminder`}
          download
          className="text-primary mt-2 text-sm font-semibold underline"
        >
          📅 휴대폰 캘린더에 투약일 알림 추가 (.ics)
        </a>
      </Card>

      <Card>
        <DoseForm
          drug={e.drug}
          doseMg={e.doseMg}
          suggestedSite={suggestNextSite(doses)}
          today={today}
          earliest={addDaysIso(today, -(CARE_EDITABLE_DAYS - 1))}
          nowTime={kstTime(now)}
        />
      </Card>

      <details className="border-border bg-surface rounded-2xl border p-5">
        <summary className="cursor-pointer font-semibold">
          담당 의사가 용량을 바꿨어요
        </summary>
        <p className="text-muted mt-3 mb-3 text-sm leading-relaxed">
          진료에서 정한 새 용량을 기록해 두면, 투약 기록과 용량별 변화 비교에
          쓰여요. 용량은 담당 의사가 정해요.
        </p>
        <CurrentDoseForm drug={e.drug} doseMg={e.doseMg} today={today} />
      </details>

      <details
        className="border-border bg-surface rounded-2xl border p-5"
        open={!!e.stopped}
      >
        <summary className="cursor-pointer font-semibold">
          {e.stopped ? "치료 중단으로 기록됨" : "치료를 그만두셨나요?"}
        </summary>
        <div className="mt-3">
          <TreatmentStopForm stopped={e.stopped} today={today} />
        </div>
      </details>

      <section className="flex flex-col gap-3" aria-labelledby="dose-history">
        <h2 id="dose-history" className="text-lg font-bold">
          최근 기록
        </h2>
        {doses.length === 0 ? (
          <p className="text-muted text-sm">아직 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {doses.slice(0, HISTORY).map((d) => (
              <li
                key={d.id}
                className="border-border bg-surface flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {formatDateTime(d.takenAt)}
                  </span>
                  <span className="text-muted">
                    {d.status === "TAKEN"
                      ? `${formatDose(d.doseMg)}${d.site ? ` · ${siteLabels[d.site]}` : ""}`
                      : "놓침"}
                  </span>
                </span>
                <form action={deleteDoseAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button
                    type="submit"
                    className="text-muted min-h-10 px-2 underline"
                    aria-label={`${formatDateTime(d.takenAt)} 기록 삭제`}
                  >
                    삭제
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted bg-surface border-border rounded-xl border p-3 text-xs leading-relaxed">
        {careDisclaimer}
      </p>
    </>
  );
}
