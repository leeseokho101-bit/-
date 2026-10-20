"use client";

import { useState } from "react";
import { GLUCOSE_RANGES, type GlucosePoint } from "@/domain/glp1/cgm";
import { HOUR_MS, kstTime } from "@/domain/glp1/time";

const W = 340;
const H = 180;
const PAD = { left: 30, right: 8, top: 8, bottom: 22 };
const Y_MIN = 40;
const Y_MAX = 300;

/**
 * 하루 혈당 선 그래프 (단일 계열 → 범례 없음).
 * 목표 범위(70~180)는 옅은 띠, 식사 시각은 아래쪽 표시. 가리키거나 키보드로 옮기면 시각·값을 보여준다.
 * 같은 내용을 시간대별 평균 표로도 제공한다 (스크린리더·색 구분 어려운 경우).
 */
export function DayGlucoseChart({
  points,
  dayStart,
  meals,
}: {
  points: GlucosePoint[];
  /** 그 날 00:00 (KST) */
  dayStart: number;
  meals: { at: number; label: string }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const x = (t: number) =>
    PAD.left + ((t - dayStart) / (24 * HOUR_MS)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top +
    (1 - (Math.min(Y_MAX, Math.max(Y_MIN, v)) - Y_MIN) / (Y_MAX - Y_MIN)) *
      (H - PAD.top - PAD.bottom);

  // 20분 넘게 끊긴 곳에서는 선을 나눈다
  const paths: string[] = [];
  let d = "";
  points.forEach((p, i) => {
    const gap = i > 0 && p.t - points[i - 1].t > 20 * 60 * 1000;
    d += `${!d || gap ? (d ? ` M` : "M") : " L"}${x(p.t).toFixed(1)},${y(p.mgdl).toFixed(1)}`;
  });
  if (d) paths.push(d);

  const nearest = (clientX: number, rect: DOMRect) => {
    if (!points.length) return null;
    const t =
      dayStart +
      ((((clientX - rect.left) / rect.width) * W - PAD.left) /
        (W - PAD.left - PAD.right)) *
        24 *
        HOUR_MS;
    let best = 0;
    for (let i = 1; i < points.length; i++)
      if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    return best;
  };
  const p = active !== null ? points[active] : null;

  const hourly = Array.from({ length: 8 }, (_, i) => {
    const from = dayStart + i * 3 * HOUR_MS;
    const vals = points.filter((q) => q.t >= from && q.t < from + 3 * HOUR_MS);
    return {
      label: `${String(i * 3).padStart(2, "0")}~${String(i * 3 + 3).padStart(2, "0")}시`,
      avg: vals.length
        ? Math.round(vals.reduce((a, q) => a + q.mgdl, 0) / vals.length)
        : null,
    };
  });

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-muted">하루 혈당 (mg/dL)</span>
        <span className="font-semibold" aria-live="polite">
          {p ? `${kstTime(p.t)} · ${p.mgdl}` : " "}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="하루 혈당 그래프. 아래 표에 시간대별 평균이 있어요."
        tabIndex={0}
        onPointerMove={(e) =>
          setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))
        }
        onPointerLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (!points.length) return;
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const step = e.key === "ArrowRight" ? 1 : -1;
            setActive((a) =>
              Math.min(points.length - 1, Math.max(0, (a ?? -step) + step)),
            );
          }
        }}
        onBlur={() => setActive(null)}
      >
        {/* 목표 범위 띠 */}
        <rect
          x={PAD.left}
          y={y(GLUCOSE_RANGES.high)}
          width={W - PAD.left - PAD.right}
          height={y(GLUCOSE_RANGES.low) - y(GLUCOSE_RANGES.high)}
          className="fill-chart-track"
        />
        {[GLUCOSE_RANGES.low, GLUCOSE_RANGES.high, 250].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeDasharray={v === 250 ? "3 3" : undefined}
            />
            <text
              x={PAD.left - 4}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted text-[9px]"
            >
              {v}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18, 24].map((h) => (
          <text
            key={h}
            x={x(dayStart + h * HOUR_MS)}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted text-[9px]"
          >
            {h}시
          </text>
        ))}
        {paths.map((pd, i) => (
          <path
            key={i}
            d={pd}
            fill="none"
            className="stroke-chart-1"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {meals.map((m) => (
          <g key={m.at}>
            <title>{`${kstTime(m.at)} ${m.label}`}</title>
            <path
              d={`M${x(m.at)},${H - PAD.bottom - 1} l-4,-7 h8 z`}
              className="fill-foreground"
            />
          </g>
        ))}
        {p && (
          <>
            <line
              x1={x(p.t)}
              x2={x(p.t)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-muted"
              strokeWidth={1}
            />
            <circle
              cx={x(p.t)}
              cy={y(p.mgdl)}
              r={4}
              className="fill-chart-1 stroke-surface"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
      <p className="text-muted text-xs">
        옅은 띠: 목표 범위 70~180 · ▼ 식사 기록 시각 · 그래프를 누르거나 ←→ 키로
        값을 볼 수 있어요
      </p>
      <details className="text-sm">
        <summary className="text-primary cursor-pointer font-semibold">
          시간대별 평균 표로 보기
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-medium">시간대</th>
              <th className="py-1 text-right font-medium">평균 (mg/dL)</th>
            </tr>
          </thead>
          <tbody>
            {hourly.map((h) => (
              <tr key={h.label} className="border-border border-t">
                <td className="py-1">{h.label}</td>
                <td className="py-1 text-right">{h.avg ?? "기록 없음"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
