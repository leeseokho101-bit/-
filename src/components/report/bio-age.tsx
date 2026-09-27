import { Card } from "@/components/ui/card";
import {
  formatAge,
  formatGap,
  gapTone,
  medicationNote,
  metabolicFactorLabels,
  organContent,
  projectionText,
} from "@/content/bio-age";
import type {
  BioAgeResult,
  MetabolicFactor,
  OrganAge,
} from "@/domain/bio-age/types";
import { METRICS } from "@/domain/health-snapshot/metrics";
import { DRUG_CLASS_LABELS, THERAPY_LABELS } from "@/domain/medication/catalog";

function GapBadge({ gap }: { gap: number | null }) {
  const t = gapTone(gap);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${t.tone}`}
    >
      {t.label}
    </span>
  );
}

const fmtValue = (v: number, decimals: number) =>
  v.toFixed(decimals).replace(/\.0+$/, "");

/** 실제 나이 대비 생체나이 요약 */
export function BioAgeSummary({ result }: { result: BioAgeResult }) {
  const { overall, chronologicalAge } = result;
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-muted text-sm">실제 나이 {chronologicalAge}세</p>
      {overall ? (
        <>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-muted">종합 생체나이</span>
            <span className="text-3xl font-bold">{formatAge(overall.age)}</span>
            <span className="text-lg font-semibold">
              ({formatGap(overall.gap)})
            </span>
          </p>
          <GapBadge gap={overall.gap} />
          <p className="text-muted text-sm leading-relaxed">
            대사증후군 나이를 뺀 {overall.organCount}개 영역의 약 복용 보정
            생체나이 평균이에요.
          </p>
        </>
      ) : (
        <p className="text-muted">
          건강검진 수치를 입력하면 생체나이를 계산할 수 있어요.
        </p>
      )}
    </Card>
  );
}

export function OrganAgeCard({ organ }: { organ: OrganAge }) {
  const c = organContent[organ.organ];
  const note = medicationNote(organ);
  const adjusted =
    organ.medication === "QUANTIFIED" &&
    organ.adjustedGap !== null &&
    organ.adjustedGap !== organ.measuredGap;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-lg font-bold">
            <span aria-hidden className="mr-1">
              {c.icon}
            </span>
            {c.label}
          </h3>
          <p className="text-muted text-xs">{c.metricsText}</p>
        </div>
        <GapBadge gap={organ.adjustedGap} />
      </div>

      {organ.status === "OK" ? (
        <dl className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-background rounded-xl p-2">
            <dt className="text-muted text-xs">검진 수치 기준</dt>
            <dd className="text-xl font-bold">
              {formatAge(organ.measuredAge!)}
            </dd>
            <dd className="text-sm font-semibold">
              {formatGap(organ.measuredGap!)}
            </dd>
          </div>
          <div
            className={`rounded-xl p-2 ${adjusted ? "bg-primary/10" : "bg-background"}`}
          >
            <dt className="text-muted text-xs">약 복용 보정</dt>
            <dd className="text-xl font-bold">
              {formatAge(organ.adjustedAge!)}
            </dd>
            <dd className="text-sm font-semibold">
              {formatGap(organ.adjustedGap!)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted text-sm">
          관련 검진 수치를 입력하면 {c.label}를 계산할 수 있어요.
        </p>
      )}

      {note && <p className="text-sm leading-relaxed">💊 {note}</p>}

      {organ.metrics.length > 0 && (
        <details className="text-sm">
          <summary className="text-primary cursor-pointer font-semibold">
            계산 근거 보기
          </summary>
          <p className="text-muted mt-2 text-xs">{c.description}</p>
          <table className="mt-2 w-full text-left text-xs">
            <caption className="sr-only">{c.label} 계산 근거</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-1 font-medium">
                  지표
                </th>
                <th scope="col" className="py-1 font-medium">
                  내 값
                </th>
                <th scope="col" className="py-1 font-medium">
                  또래 평균
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  나이 환산
                </th>
              </tr>
            </thead>
            <tbody>
              {organ.metrics.map((m) => {
                const def = METRICS[m.metric];
                return (
                  <tr key={m.metric} className="border-border border-t">
                    <th scope="row" className="py-1.5 font-medium">
                      {def.label}
                      {m.derived && (
                        <span className="text-muted"> (계산값)</span>
                      )}
                    </th>
                    <td className="py-1.5">
                      {fmtValue(m.value, def.decimals)}
                      {m.adjustedValue !== undefined && (
                        <span className="text-muted block">
                          약 없을 때 약{" "}
                          {fmtValue(m.adjustedValue, def.decimals)}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {fmtValue(m.referenceMean, def.decimals)} {def.unit}
                    </td>
                    <td className="py-1.5 text-right">
                      {formatGap(m.gapYears)}
                      {m.adjustedGapYears !== m.gapYears && (
                        <span className="text-muted block">
                          보정 {formatGap(m.adjustedGapYears)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </Card>
  );
}

function factorValue(f: MetabolicFactor): string {
  if (f.value === null && f.metByTherapy) return "약 복용 중";
  if (f.value === null) return "미입력";
  const main =
    f.factor === "BLOOD_PRESSURE"
      ? `${f.value}/${f.value2 ?? "-"}`
      : String(f.value);
  const adj =
    f.factor === "BLOOD_PRESSURE"
      ? f.adjustedValue !== f.value || f.adjustedValue2 !== f.value2
        ? `${f.adjustedValue}/${f.adjustedValue2 ?? "-"}`
        : null
      : f.adjustedValue !== f.value
        ? String(f.adjustedValue)
        : null;
  return adj ? `${main} (약 없을 때 약 ${adj})` : main;
}

function factorStatus(f: MetabolicFactor): string {
  if (f.met) return f.metByTherapy ? "해당 (관련 약 복용)" : "해당";
  if (f.value === null) return "-";
  if (f.yearsToMeet === null) return "당분간 여유";
  return `약 ${f.yearsToMeet}년 뒤 도달 추정`;
}

export function MetabolicSection({ result }: { result: BioAgeResult }) {
  const organ = result.organs.find((o) => o.organ === "METABOLIC")!;
  const projection = projectionText(result);
  const { metabolic } = result;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="metabolic-title">
      <h2 id="metabolic-title" className="text-lg font-bold">
        대사증후군 나이와 도달 시점 추정
      </h2>
      <OrganAgeCard organ={organ} />
      <Card className="flex flex-col gap-3">
        <p className="text-muted text-sm">
          대사증후군 판정 기준 도달 추정 (5개 요소 중 3개 이상)
        </p>
        <p className="text-xl font-bold">{projection.title}</p>
        <p className="leading-relaxed">{projection.body}</p>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            대사증후군 판정 기준 요소별 상태
          </caption>
          <thead className="text-muted text-xs">
            <tr>
              <th scope="col" className="py-1 font-medium">
                요소 (기준)
              </th>
              <th scope="col" className="py-1 font-medium">
                내 값
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {metabolic.factors.map((f) => (
              <tr key={f.factor} className="border-border border-t">
                <th scope="row" className="py-2 font-medium">
                  {metabolicFactorLabels[f.factor]}
                  <span className="text-muted block text-xs font-normal">
                    {f.criterion}
                  </span>
                </th>
                <td className="py-2">{factorValue(f)}</td>
                <td
                  className={`py-2 text-right ${f.met ? "font-semibold text-rose-800" : ""}`}
                >
                  {f.met && <span aria-hidden>● </span>}
                  {factorStatus(f)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted text-xs leading-relaxed">
          현재 {metabolic.metCount}개 해당 · 입력 {metabolic.availableCount}
          /5개. 대사증후군 나이가 실제 나이보다 많을수록 수치가 더 빨리 변한다고
          보고 계산했어요. 추정은 생활습관이 지금과 같다는 가정이며, 실제와 다를
          수 있어요.
        </p>
      </Card>
    </section>
  );
}

export function MedicationBreakdown({ result }: { result: BioAgeResult }) {
  const { ingredients, effect, therapies, unquantified } = result.medications;
  if (therapies.length === 0) return null;
  const rows = [
    effect.sbp > 0 && `수축기 혈압 약 ${effect.sbp}mmHg`,
    effect.dbp > 0 && `이완기 혈압 약 ${effect.dbp}mmHg`,
    effect.hba1c > 0 && `당화혈색소 약 ${effect.hba1c}%p`,
    effect.fpg > 0 && `공복혈당 약 ${effect.fpg}mg/dL`,
    effect.ldlPct > 0 && `LDL 약 ${Math.round(effect.ldlPct * 100)}%`,
    effect.tgPct > 0 && `중성지방 약 ${Math.round(effect.tgPct * 100)}%`,
  ].filter(Boolean) as string[];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="meds-title">
      <h2 id="meds-title" className="text-lg font-bold">
        복용약 보정 내역
      </h2>
      <Card className="flex flex-col gap-3 text-sm">
        {ingredients.length > 0 ? (
          <>
            <p className="text-muted">
              복합제는 단일 성분으로 나눠 하루 용량을 계산했어요.
            </p>
            <ul className="flex flex-col gap-1.5">
              {ingredients.map((i) => (
                <li
                  key={i.ingredient}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    <span className="font-semibold">{i.name}</span>{" "}
                    <span className="text-muted text-xs">
                      {THERAPY_LABELS[i.therapy]} ·{" "}
                      {DRUG_CLASS_LABELS[i.drugClass]}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">
                    하루 {i.dailyMg}mg
                  </span>
                </li>
              ))}
            </ul>
            {rows.length > 0 && (
              <p className="leading-relaxed">
                임상연구의 평균 효과로 보면 이 약들은{" "}
                <strong>{rows.join(", ")}</strong> 정도 수치를 낮추는 것으로
                알려져 있어요. 생체나이 보정에는 이 평균 범위를 적용했어요.
              </p>
            )}
          </>
        ) : null}
        {unquantified.length > 0 && (
          <p className="text-muted leading-relaxed">
            {unquantified.map((t) => THERAPY_LABELS[t]).join("·")}은 성분·함량
            정보가 없어 보정하지 않았어요.
          </p>
        )}
      </Card>
    </section>
  );
}
