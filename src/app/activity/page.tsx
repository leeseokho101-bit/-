import { PageContainer } from "@/components/layout/page-container";
import { ActivityProjectionView } from "@/components/report/activity-projection";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  activityDisclaimer,
  exerciseTypeLabels,
  intensityLabels,
} from "@/content/activity";
import { ActivityForm } from "@/features/activity/activity-form";
import { addDays, EDITABLE_DAYS, koreaDate } from "@/features/activity/date";
import { getActivityOverview } from "@/features/activity/service";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "활동 기록 | 입체적 건강분석" };

const RECENT_DAYS = 14;

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const w = "일월화수목금토"[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${w})`;
}

export default async function ActivityPage() {
  const user = await requireUser(routes.activity);
  const today = koreaDate();
  const earliest = addDays(today, -(EDITABLE_DAYS - 1));
  const { logs, age, projection } = await getActivityOverview(
    db,
    user.id,
    today,
  );
  const recent = logs.filter(
    (l) => l.date >= addDays(today, -(RECENT_DAYS - 1)),
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="매일 기록하면 생체나이에 반영돼요"
        title="오늘의 걸음수·운동"
        description="걸음수와 운동(종류·강도·시간)을 기록하면, 임상시험에서 확인된 평균 효과로 검진 수치 변화를 추정해 예상 생체나이를 보여 드려요."
      />

      <Card>
        <ActivityForm
          today={today}
          earliest={earliest}
          logs={logs.filter((l) => l.date >= earliest)}
        />
      </Card>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="projection-title"
      >
        <h2 id="projection-title" className="text-lg font-bold">
          운동 반영 예상 생체나이
        </h2>
        {age === null ? (
          <Card className="flex flex-col gap-3 text-center">
            <p className="font-semibold">
              건강분석을 마치면 예상 생체나이를 볼 수 있어요
            </p>
            <p className="text-muted text-sm">
              검진 수치를 기준으로 운동 효과를 계산해요. 기록은 그대로 쌓여요.
            </p>
            <ButtonLink href={routes.assessment}>건강분석 하기</ButtonLink>
          </Card>
        ) : projection ? (
          <Card>
            <ActivityProjectionView projection={projection} age={age} />
          </Card>
        ) : (
          <Card>
            <p className="text-muted text-sm leading-relaxed">
              첫 기록을 저장하면 예상 생체나이가 여기에 나타나요. 매일
              기록할수록 정확해지고, 효과는 약 12주에 걸쳐 쌓여요.
            </p>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="recent-title">
        <h2 id="recent-title" className="text-lg font-bold">
          최근 {RECENT_DAYS}일 기록
        </h2>
        {recent.length === 0 ? (
          <p className="text-muted text-sm">아직 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((l) => (
              <li
                key={l.date}
                className="border-border bg-surface flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">{formatDay(l.date)}</span>
                  <span>
                    {l.steps !== null
                      ? `${l.steps.toLocaleString()}보`
                      : "걸음수 -"}
                  </span>
                </div>
                {l.sessions.map((s, i) => (
                  <span key={i} className="text-muted">
                    {exerciseTypeLabels[s.type]} ·{" "}
                    {intensityLabels[s.intensity].label} · {s.minutes}분
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted bg-surface border-border rounded-xl border p-3 text-xs leading-relaxed">
        {activityDisclaimer}
      </p>
    </PageContainer>
  );
}
