import Link from "next/link";
import { AlertList } from "@/components/care/alert-list";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  careDisclaimer,
  escalationSupport,
  siteLabels,
  triageContent,
} from "@/content/care";
import { glucoseStats, TIR_TARGETS } from "@/domain/glp1/cgm";
import {
  doseSchedule,
  ESCALATION_SUPPORT_DAYS,
  daysOnCurrentDose,
  suggestNextSite,
} from "@/domain/glp1/dosing";
import { doseStepNumber, formatDose } from "@/domain/glp1/drugs";
import { addDaysIso, DAY_MS, kstDayStart } from "@/domain/glp1/time";
import { dueText, formatDateTime, formatDay } from "@/features/care/format";
import {
  latestGlucose,
  listCheckIns,
  listDoses,
  listMeals,
  loadGlucose,
  refreshAlerts,
} from "@/features/care/service";
import { requireEnrollment } from "@/features/care/session";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "GLP-1 케어 | 입체적 건강분석" };

function Section({
  title,
  href,
  link,
  children,
}: {
  title: string;
  href?: string;
  link?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-primary text-sm font-semibold underline"
          >
            {link ?? "자세히"}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function CareHomePage() {
  const {
    user,
    enrollment: e,
    today,
    now,
  } = await requireEnrollment(routes.care);
  const [doses, alerts, checkIns, latest, glucose14, meals] = await Promise.all(
    [
      listDoses(db, user.id, new Date(now - 60 * DAY_MS)),
      refreshAlerts(db, user.id, today),
      listCheckIns(db, user.id, today, 1),
      latestGlucose(db, user.id),
      loadGlucose(db, user.id, kstDayStart(addDaysIso(today, -13)), now),
      listMeals(
        db,
        user.id,
        kstDayStart(today),
        kstDayStart(addDaysIso(today, 1)),
      ),
    ],
  );
  const schedule = doseSchedule(e.drug, e.startDate, doses, today);
  const site = suggestNextSite(doses);
  const todayCheckIn = checkIns[0]?.date === today ? checkIns[0] : null;
  const stats14 = glucoseStats(
    glucose14,
    now - kstDayStart(addDaysIso(today, -13)),
  );
  const onDose = daysOnCurrentDose(e.doseSince, today);
  const step = doseStepNumber(e.drug, e.doseMg);
  const recentlyChanged =
    onDose >= 0 &&
    onDose < ESCALATION_SUPPORT_DAYS &&
    e.doseSince > e.startDate;

  return (
    <>
      <PageHeader
        eyebrow={`${e.drug.ingredient} · ${formatDose(e.doseMg)}${step ? ` (${step}단계)` : ""}`}
        title={`${user.displayName}님, 오늘도 함께해요`}
        description={
          e.clinic
            ? `${e.clinic.name}과 연결되어 있어요.${e.nextVisitOn ? ` 다음 내원 예정일은 ${formatDay(e.nextVisitOn)}이에요.` : ""}`
            : undefined
        }
      />

      <AlertList
        alerts={alerts}
        clinicName={e.clinic?.name ?? null}
        shareWithClinic={e.shareWithClinic}
      />

      <Section title="다음 투약" href={routes.careDose} link="투약 기록">
        <Card className="flex flex-col gap-3">
          <p
            className={`text-xl font-bold ${schedule.daysUntil < 0 ? "text-rose-800" : ""}`}
          >
            {dueText(schedule.daysUntil)}
          </p>
          <p className="text-muted text-sm">
            예정일 {schedule.nextDue} · {formatDose(e.doseMg)}
            {e.drug.route === "INJECTION" &&
              ` · 추천 부위: ${siteLabels[site]}`}
          </p>
          {schedule.daysUntil < 0 && (
            <p className="text-sm leading-relaxed">
              이미 투약했다면 기록해 주세요. 놓쳤다면 다음 투약을 언제 할지 담당
              의원에 물어보세요.
            </p>
          )}
          <ButtonLink href={routes.careDose}>
            {schedule.daysUntil <= 0 ? "투약 기록하기" : "투약 기록 보기"}
          </ButtonLink>
        </Card>
        {recentlyChanged && (
          <p className="bg-primary/5 border-primary/20 rounded-xl border px-4 py-3 text-sm leading-relaxed">
            용량을 바꾼 지 {onDose + 1}일째예요. {escalationSupport}
          </p>
        )}
      </Section>

      <Section
        title="오늘 체크인"
        href={routes.careCheckIn}
        link={todayCheckIn ? "고치기" : "하러 가기"}
      >
        <Card className="flex flex-col gap-3">
          {todayCheckIn ? (
            <>
              <p className="font-semibold">
                {triageContent[todayCheckIn.triage].title}
              </p>
              <p className="text-muted text-sm leading-relaxed">
                {triageContent[todayCheckIn.triage].body}
              </p>
            </>
          ) : (
            <>
              <p className="leading-relaxed">
                오늘 몸 상태는 어떤가요? 1분이면 끝나요.
              </p>
              <ButtonLink href={routes.careCheckIn}>체크인 하기</ButtonLink>
            </>
          )}
        </Card>
      </Section>

      <Section title="혈당" href={routes.careGlucose}>
        <Card className="flex flex-col gap-2">
          {latest ? (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-muted text-sm">최근 값</span>
                <span className="text-2xl font-bold">{latest.mgdl}</span>
                <span className="text-muted text-sm">
                  mg/dL · {formatDateTime(latest.t)}
                </span>
              </p>
              {stats14 && (
                <p className="text-sm">
                  최근 14일 목표 범위 안 시간{" "}
                  <span className="font-bold">{stats14.pct.IN_RANGE}%</span>{" "}
                  <span className="text-muted">
                    (참고 목표 {TIR_TARGETS.inRangeMin}% 이상)
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed">
              CGM 기록을 올리면 혈당 변화와 식후 반응을 보여드려요.
            </p>
          )}
        </Card>
      </Section>

      <Section title="오늘 식사" href={routes.careMeals} link="기록하기">
        <Card className="text-sm">
          {meals.length
            ? `오늘 ${meals.length}끼를 기록했어요. 단백질 합계 ${meals.reduce((a, m) => a + (m.proteinG ?? 0), 0)}g`
            : "아직 기록한 식사가 없어요."}
        </Card>
      </Section>

      <ButtonLink href={routes.careResponse} variant="secondary">
        나의 약물 반응 타임라인 보기
      </ButtonLink>
      <div className="flex justify-between text-sm">
        <Link href={routes.careSettings} className="text-muted underline">
          케어 설정
        </Link>
        <Link href={routes.dashboard} className="text-muted underline">
          건강분석 대시보드
        </Link>
      </div>
      <p className="text-muted bg-surface border-border rounded-xl border p-3 text-xs leading-relaxed">
        {careDisclaimer}
      </p>
    </>
  );
}
