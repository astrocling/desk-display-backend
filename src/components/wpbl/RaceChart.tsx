"use client";

import { useMemo } from "react";

import type { WpblRaceSeries, WpblRacesResponse } from "@/lib/types/wpbl-display";
import { wpblTeamPrimaryDark } from "@/lib/wpbl-team-brand";

import type { ChartableRaceId } from "./leadersCategories";

const LABEL: Record<ChartableRaceId, string> = {
  hr: "Home runs",
  rbi: "RBI",
  sb: "Stolen bases",
  so: "Strikeouts",
};

export type RaceChartProps = {
  races: WpblRacesResponse | null;
  raceId: ChartableRaceId;
  loading?: boolean;
  error?: string | null;
};

type PreparedSeries = WpblRaceSeries & {
  color: string;
  path: string;
};

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

export function RaceChart({
  races,
  raceId,
  loading,
  error,
}: RaceChartProps) {
  const series = races?.races[raceId] ?? [];

  const chart = useMemo(() => {
    const width = 640;
    const height = 240;
    const pad = { top: 12, right: 12, bottom: 32, left: 32 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const allDates = [
      ...new Set(series.flatMap((s) => s.points.map((p) => p.date))),
    ].sort();
    const maxVal = Math.max(1, ...series.map((s) => s.total));

    if (allDates.length === 0 || series.length === 0) {
      return {
        width,
        height,
        pad,
        prepared: [] as PreparedSeries[],
        allDates,
        maxVal,
        innerW,
        innerH,
      };
    }

    const xAt = (date: string) => {
      if (allDates.length === 1) return pad.left + innerW / 2;
      const i = allDates.indexOf(date);
      return pad.left + (i / (allDates.length - 1)) * innerW;
    };
    const yAt = (value: number) =>
      pad.top + innerH - (value / maxVal) * innerH;

    const prepared: PreparedSeries[] = series.map((s) => {
      const pts = s.points.map((p) => ({
        x: xAt(p.date),
        y: yAt(p.value),
      }));
      return {
        ...s,
        color: wpblTeamPrimaryDark(s.teamAbbr),
        path: buildPath(pts),
      };
    });

    return { width, height, pad, prepared, allDates, maxVal, innerW, innerH };
  }, [series]);

  return (
    <div className="wpbl-panel" id="wpbl-race-chart">
      <div className="border-b border-[var(--wpbl-rule)] px-4 py-2.5">
        <p className="text-sm font-semibold text-[var(--wpbl-ink)]">
          {LABEL[raceId]} over time
        </p>
        <p className="mt-0.5 text-[11px] wpbl-muted">
          Cumulative from game logs
        </p>
      </div>

      {loading && !races ? (
        <p className="px-4 py-8 text-sm wpbl-muted">Loading race chart…</p>
      ) : error && !races ? (
        <p className="px-4 py-8 text-sm wpbl-muted">{error}</p>
      ) : series.length === 0 ? (
        <p className="px-4 py-8 text-sm wpbl-muted">
          No {LABEL[raceId]} race data yet — player game logs may still be
          warming.
        </p>
      ) : (
        <div className="px-2 pb-3 pt-2 sm:px-4">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="wpbl-race-chart"
            role="img"
            aria-label={`${LABEL[raceId]} race chart`}
          >
            {[0, 0.5, 1].map((t) => {
              const y = chart.pad.top + chart.innerH * (1 - t);
              const label = Math.round(chart.maxVal * t);
              return (
                <g key={t}>
                  <line
                    x1={chart.pad.left}
                    x2={chart.width - chart.pad.right}
                    y1={y}
                    y2={y}
                    className="wpbl-race-chart__grid"
                  />
                  <text
                    x={chart.pad.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="wpbl-race-chart__axis"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            {chart.allDates.length > 1 ? (
              <>
                <text
                  x={chart.pad.left}
                  y={chart.height - 8}
                  className="wpbl-race-chart__axis"
                >
                  {chart.allDates[0]}
                </text>
                <text
                  x={chart.width - chart.pad.right}
                  y={chart.height - 8}
                  textAnchor="end"
                  className="wpbl-race-chart__axis"
                >
                  {chart.allDates[chart.allDates.length - 1]}
                </text>
              </>
            ) : null}
            {chart.prepared.map((s) => (
              <path
                key={s.playerId}
                d={s.path}
                fill="none"
                stroke={s.color}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="wpbl-race-chart__line"
              />
            ))}
            {chart.prepared.map((s) => {
              const last = s.points[s.points.length - 1];
              if (!last) return null;
              const i = chart.allDates.indexOf(last.date);
              const x =
                chart.allDates.length <= 1
                  ? chart.pad.left + chart.innerW / 2
                  : chart.pad.left +
                    (i / (chart.allDates.length - 1)) * chart.innerW;
              const y =
                chart.pad.top +
                chart.innerH -
                (last.value / chart.maxVal) * chart.innerH;
              return (
                <circle
                  key={`${s.playerId}-dot`}
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill={s.color}
                />
              );
            })}
          </svg>

          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
            {chart.prepared.map((s) => (
              <li
                key={s.playerId}
                className="flex items-center gap-2 text-xs text-[var(--wpbl-ink-secondary)]"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium text-[var(--wpbl-ink)]">
                  {s.name}
                </span>
                <span className="tabular-nums wpbl-muted">
                  {s.teamAbbr} · {s.total}
                </span>
              </li>
            ))}
          </ul>
          {races?.partial ? (
            <p className="mt-2 px-1 text-[11px] wpbl-muted">
              Some race lines may be incomplete while player caches warm.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
