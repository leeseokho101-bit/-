import { Card } from "@/components/ui/card";
import { activitySourceLabels, activityTargets } from "@/content/activity";
import { organContent } from "@/content/bio-age";
import type {
  ActivityProjection,
  ActivityScenario,
} from "@/domain/bio-age/activity";
import { METRICS } from "@/domain/health-snapshot/metrics";

const age1 = (n: number) => `${n.toFixed(1)}세`;
const delta1 = (n: number) =>
  n === 0 ? "±0" : n > 0 ? `+${n.toFixed(1)}` : `−${Math.abs(n).toFixed(1)}`;

function ScenarioAge({
  title,
  scenario,
}: {
  title: string;
  scenario: ActivityScenario;
}) {
  const o = scenario.overall;
  return (
    <div className="bg-background flex flex-col gap-1 rounded-xl p-3">
      <p className="text-muted text-sm">{title}</p>
      {o ? (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-bold">{age1(o.projected)}</span>
          <span className="font-semibold">({delta1(o.delta)}세)</span>
        </p>
      ) : (
        <p className="text-muted text-sm">계산할 검진 수치가 부족해요</p>
      )}
      <p className="text-muted text-xs">
        효과 반영 {Math.round(scenario.ramp * 100)}%
      </p>
    </div>
  );
}

/** 운동 반영 예상 생체나이 요약 (활동 기록 화면·생체나이 화면 공통) */
export function ActivityProjectionView({
  projection,
  age,
  compact = false,
}: {
  projection: ActivityProjection;
  age: number;
  compact?: boolean;
}) {
  const { summary, now, sustained } = projection;
  const current = now.overall?.current;
  return (
    <div className="flex flex-col gap-4">
      {current !== undefined && (
        <p className="text-sm">
          검진 기준 생체나이{" "}
          <strong className="text-base">{age1(current)}</strong>
          <span className="text-muted"> (실제 {age}세)</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <ScenarioAge title="지금까지 기록 반영" scenario={now} />
        <ScenarioAge title="지금처럼 12주 계속하면" scenario={sustained} />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="bg-background rounded-lg p-2">
          <dt className="text-muted text-xs">평균 걸음수</dt>
          <dd className="font-semibold">
            {summary.avgSteps !== null
              ? `${summary.avgSteps.toLocaleString()}보`
              : "-"}
          </dd>
        </div>
        <div className="bg-background rounded-lg p-2">
          <dt className="text-muted text-xs">주당 유산소</dt>
          <dd className="font-semibold">
            {Math.round(summary.weekly.aerobicMin)}분
          </dd>
        </div>
        <div className="bg-background rounded-lg p-2">
          <dt className="text-muted text-xs">주당 근력</dt>
          <dd className="font-semibold">
            {Math.round(
              summary.weekly.strengthMin + summary.weekly.isometricMin,
            )}
            분
          </dd>
        </div>
      </dl>
      <p className="text-muted text-xs leading-relaxed">
        최근 {summary.windowDays}일 중 {summary.loggedDays}일 기록 ·
        평소(건강분석 문진)보다 늘어난 운동량: 중간 강도 환산 주{" "}
        {Math.round(summary.increase.aerobicMin)}분 (걸음수{" "}
        {Math.round(summary.increase.fromStepsMin)}분 포함), 근력 주{" "}
        {Math.round(
          summary.increase.strengthMin + summary.increase.isometricMin,
        )}
        분. 기록하지 않은 날은 평소와 같다고 봐요.
      </p>

      {!compact && sustained.organs.some((o) => o.delta !== 0) && (
        <section className="flex flex-col gap-2" aria-labelledby="organ-change">
          <h3 id="organ-change" className="font-semibold">
            영역별 예상 변화 (12주 계속 시)
          </h3>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {sustained.organs
              .filter((o) => o.delta !== 0)
              .map((o) => (
                <li
                  key={o.organ}
                  className="bg-background flex justify-between rounded-lg px-3 py-2"
                >
                  <span>{organContent[o.organ].label}</span>
                  <span className="font-semibold">{delta1(o.delta)}세</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {!compact && sustained.changes.length > 0 && (
        <section
          className="flex flex-col gap-2"
          aria-labelledby="metric-change"
        >
          <h3 id="metric-change" className="font-semibold">
            예상 수치 변화와 근거 (12주 계속 시)
          </h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {sustained.changes.map((c) => (
              <li
                key={c.metric}
                className="bg-background flex flex-col rounded-lg px-3 py-2"
              >
                <span>
                  {METRICS[c.metric].label}{" "}
                  <strong>
                    {c.from} → {c.to}
                  </strong>{" "}
                  <span className="text-muted">{METRICS[c.metric].unit}</span>
                </span>
                <span className="text-muted text-xs">
                  {activitySourceLabels[c.source] ?? c.source}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && (
        <Card className="bg-primary/5 border-primary/20">
          <h3 className="font-semibold">목표로 삼기 좋은 활동량</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
            <li>
              {activityTargets.steps(age)}
              <br />
              <span className="text-muted text-xs">
                {activityTargets.stepsSource}
              </span>
            </li>
            <li>
              {activityTargets.aerobic}
              <br />
              <span className="text-muted text-xs">
                {activityTargets.aerobicSource}
              </span>
            </li>
            <li>
              {activityTargets.strength}
              <br />
              <span className="text-muted text-xs">
                {activityTargets.strengthSource}
              </span>
            </li>
          </ul>
        </Card>
      )}
    </div>
  );
}
