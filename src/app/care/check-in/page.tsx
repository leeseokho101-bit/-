import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  copingTips,
  escalationTip,
  redFlagLabels,
  severityLabels,
  symptomLabels,
  triageContent,
} from "@/content/care";
import { SYMPTOMS, triageCheckIn } from "@/domain/glp1/symptoms";
import { CheckInForm } from "@/features/care/check-in-form";
import { formatDay } from "@/features/care/format";
import { listCheckIns } from "@/features/care/service";
import { requireEnrollment } from "@/features/care/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "부작용 체크인 | GLP-1 케어" };

const toneClass = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-950",
  info: "border-primary/20 bg-primary/5",
  warn: "border-amber-300 bg-amber-50 text-amber-950",
  danger: "border-rose-300 bg-rose-50 text-rose-950",
} as const;

export default async function CareCheckInPage() {
  const { user, today } = await requireEnrollment(routes.careCheckIn);
  const recent = await listCheckIns(db, user.id, today, 14);
  const todays = recent[0]?.date === today ? recent[0] : null;
  const triage = todays ? triageCheckIn(todays) : null;

  return (
    <>
      <PageHeader
        eyebrow={formatDay(today)}
        title="오늘의 1분 체크인"
        description="속 불편함과 몸 상태를 기록해 주세요. 대처 방법과, 필요할 때 연락할 곳을 알려드려요."
      />

      {todays && triage && (
        <section
          className={`flex flex-col gap-3 rounded-2xl border p-4 ${toneClass[triageContent[triage.level].tone]}`}
          aria-labelledby="triage-title"
        >
          <h2 id="triage-title" className="font-bold">
            {triageContent[triage.level].title}
          </h2>
          <p className="text-sm leading-relaxed">
            {triageContent[triage.level].body}
          </p>
          {todays.redFlags.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {todays.redFlags.map((f) => (
                <li key={f}>{redFlagLabels[f]}</li>
              ))}
            </ul>
          )}
          {triage.coping.map((code) => (
            <div key={code} className="flex flex-col gap-1">
              <h3 className="text-sm font-bold">
                {symptomLabels[code]} ({severityLabels[todays.symptoms[code]]})
              </h3>
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm leading-relaxed">
                {copingTips[code].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
          {triage.level !== "NONE" && (
            <p className="text-sm leading-relaxed">{escalationTip}</p>
          )}
        </section>
      )}

      <Card>
        <CheckInForm
          key={todays ? JSON.stringify(todays) : "new"}
          date={today}
          defaults={todays}
        />
      </Card>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="checkin-history"
      >
        <h2 id="checkin-history" className="text-lg font-bold">
          최근 14일
        </h2>
        {recent.length === 0 ? (
          <p className="text-muted text-sm">아직 기록이 없어요.</p>
        ) : (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="최근 체크인 기록 표 (옆으로 넘겨 보기)"
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                최근 체크인 기록 (0 없음 ~ 3 심함)
              </caption>
              <thead>
                <tr className="text-muted">
                  <th className="py-1 pr-2 font-medium">날짜</th>
                  {SYMPTOMS.map((c) => (
                    <th key={c} className="px-1 py-1 text-center font-medium">
                      {symptomLabels[c]}
                    </th>
                  ))}
                  <th className="py-1 pl-1 text-center font-medium">식욕</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.date} className="border-border border-t">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {formatDay(c.date)}
                      {(c.triage === "URGENT" ||
                        c.triage === "CONTACT_CLINIC") && (
                        <span
                          className="ml-1 text-rose-800"
                          title="의원 상담 안내"
                        >
                          ⚠<span className="sr-only">의원 상담 안내</span>
                        </span>
                      )}
                    </td>
                    {SYMPTOMS.map((s) => (
                      <td key={s} className="px-1 py-1.5 text-center">
                        {c.symptoms[s] ? c.symptoms[s] : "·"}
                      </td>
                    ))}
                    <td className="py-1.5 pl-1 text-center">
                      {c.appetite ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted mt-1 text-xs">
              숫자: 1 약간 · 2 보통 · 3 심함 · ⚠ 의원 상담 안내
            </p>
          </div>
        )}
      </section>
    </>
  );
}
