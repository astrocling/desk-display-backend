"use client";

import { useId, useMemo } from "react";

import type {
  WpblSpiderAxis,
  WpblSpiderProfile,
} from "@/lib/wpbl-spider-profile";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 78;
const LABEL_RADIUS = 98;

function polar(angleRad: number, radius: number): { x: number; y: number } {
  return {
    x: CENTER + radius * Math.sin(angleRad),
    y: CENTER - radius * Math.cos(angleRad),
  };
}

function valuePolygon(axes: WpblSpiderAxis[]): string {
  return axes
    .map((axis, i) => {
      const angle = (i / axes.length) * Math.PI * 2;
      const r = RADIUS * (axis.percentile / 100);
      const { x, y } = polar(angle, r);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function ringPolygon(count: number, scale: number): string {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const { x, y } = polar(angle, RADIUS * scale);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export type SpiderProfileChartProps = {
  profile: WpblSpiderProfile;
  /** Fill/stroke accent — typically the player's team primary. */
  accent?: string;
  className?: string;
};

/** SVG radar chart + percentile legend for one player profile. */
export function SpiderProfileChart({
  profile,
  accent = "var(--wpbl-accent)",
  className = "",
}: SpiderProfileChartProps) {
  const gradId = useId().replace(/:/g, "");
  const axes = profile.axes;
  const n = axes.length;
  const polygon = useMemo(() => valuePolygon(axes), [axes]);

  if (n < 3) return null;

  return (
    <div className={`wpbl-spider ${className}`.trim()}>
      <div className="wpbl-spider__head">
        <h3 className="wpbl-spider__title">{profile.title}</h3>
        <p className="wpbl-spider__note">
          {profile.qualified
            ? "League percentiles vs qualified leaders"
            : "Counting stats only — under rate qualifier"}
        </p>
      </div>

      <div className="wpbl-spider__body">
        <svg
          className="wpbl-spider__svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`${profile.title}: ${axes
            .map((a) => `${a.label} ${a.percentile}th percentile`)
            .join(", ")}`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.12" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <polygon
              key={scale}
              className="wpbl-spider__ring"
              points={ringPolygon(n, scale)}
            />
          ))}

          {axes.map((_, i) => {
            const angle = (i / n) * Math.PI * 2;
            const tip = polar(angle, RADIUS);
            return (
              <line
                key={`spoke-${i}`}
                className="wpbl-spider__spoke"
                x1={CENTER}
                y1={CENTER}
                x2={tip.x}
                y2={tip.y}
              />
            );
          })}

          <polygon
            className="wpbl-spider__area"
            points={polygon}
            fill={`url(#${gradId})`}
            stroke={accent}
          />

          {axes.map((axis, i) => {
            const angle = (i / n) * Math.PI * 2;
            const tip = polar(angle, RADIUS * (axis.percentile / 100));
            const labelPt = polar(angle, LABEL_RADIUS);
            return (
              <g key={axis.id}>
                <circle cx={tip.x} cy={tip.y} r={3.25} fill={accent} />
                <text
                  className="wpbl-spider__label"
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {axis.label}
                </text>
              </g>
            );
          })}
        </svg>

        <ul className="wpbl-spider__legend">
          {axes.map((axis) => (
            <li key={axis.id} className="wpbl-spider__legend-row">
              <span className="wpbl-spider__legend-stat">{axis.label}</span>
              <span className="wpbl-spider__legend-value">
                {axis.displayValue}
              </span>
              <span className="wpbl-spider__legend-pct">
                {axis.percentile}
                <span className="wpbl-spider__legend-pct-suffix">%ile</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
