"use client";

import { useId } from "react";

import type { WpblTrackingEvent } from "@/lib/types/wpbl-display";
import {
  STRIKE_ZONE,
  STRIKE_ZONE_VIEW,
  hasPlateLocation,
  strikeZonePoints,
} from "@/lib/wpbl-tracking";

export type StrikeZonePlotProps = {
  tracking: WpblTrackingEvent[];
  /** Max pitches to plot (newest first). Default 40. */
  limit?: number;
  /** Compact single-pitch glyph for a feed row. */
  event?: WpblTrackingEvent | null;
  size?: "sm" | "md";
  className?: string;
};

function mapToSvg(
  side: number,
  height: number,
  width: number,
  heightPx: number,
): { x: number; y: number } {
  const { sideMin, sideMax, heightMin, heightMax } = STRIKE_ZONE_VIEW;
  const x = ((side - sideMin) / (sideMax - sideMin)) * width;
  const y = ((heightMax - height) / (heightMax - heightMin)) * heightPx;
  return { x, y };
}

function ZoneFrame({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const zoneTL = mapToSvg(
    STRIKE_ZONE.sideMin,
    STRIKE_ZONE.heightMax,
    width,
    height,
  );
  const zoneBR = mapToSvg(
    STRIKE_ZONE.sideMax,
    STRIKE_ZONE.heightMin,
    width,
    height,
  );
  const plateTop = mapToSvg(0, STRIKE_ZONE.heightMin - 0.05, width, height);
  const plateHalf = ((0.708 - STRIKE_ZONE_VIEW.sideMin) /
    (STRIKE_ZONE_VIEW.sideMax - STRIKE_ZONE_VIEW.sideMin)) *
    width -
    mapToSvg(-0.708, STRIKE_ZONE.heightMin, width, height).x;

  return (
    <>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        className="fill-slate-100 dark:fill-slate-900"
      />
      <rect
        x={Math.min(zoneTL.x, zoneBR.x)}
        y={Math.min(zoneTL.y, zoneBR.y)}
        width={Math.abs(zoneBR.x - zoneTL.x)}
        height={Math.abs(zoneBR.y - zoneTL.y)}
        className="fill-white stroke-slate-400 dark:fill-slate-800 dark:stroke-slate-500"
        strokeWidth={1.25}
      />
      {/* Home plate silhouette under the zone */}
      <path
        d={`M ${plateTop.x - plateHalf * 0.55} ${plateTop.y + 2}
            L ${plateTop.x + plateHalf * 0.55} ${plateTop.y + 2}
            L ${plateTop.x + plateHalf * 0.55} ${plateTop.y + 8}
            L ${plateTop.x} ${plateTop.y + 14}
            L ${plateTop.x - plateHalf * 0.55} ${plateTop.y + 8} Z`}
        className="fill-slate-300 dark:fill-slate-600"
      />
    </>
  );
}

/** Catcher's-view strike zone with TrackMan plate locations. */
export function StrikeZonePlot({
  tracking,
  limit = 40,
  event = null,
  size = "md",
  className = "",
}: StrikeZonePlotProps) {
  const gradId = useId();
  const width = size === "sm" ? 72 : 160;
  const height = size === "sm" ? 88 : 196;

  if (event) {
    if (!hasPlateLocation(event)) return null;
    const pt = mapToSvg(
      event.plateLocationSide!,
      event.plateLocationHeight!,
      width,
      height,
    );
    const inZone =
      event.plateLocationSide! >= STRIKE_ZONE.sideMin &&
      event.plateLocationSide! <= STRIKE_ZONE.sideMax &&
      event.plateLocationHeight! >= STRIKE_ZONE.heightMin &&
      event.plateLocationHeight! <= STRIKE_ZONE.heightMax;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`shrink-0 rounded ${className}`}
        aria-hidden
      >
        <ZoneFrame width={width} height={height} />
        <circle
          cx={pt.x}
          cy={pt.y}
          r={size === "sm" ? 4 : 5}
          className={
            inZone
              ? "fill-red-500 dark:fill-red-400"
              : "fill-sky-500 dark:fill-sky-400"
          }
        />
      </svg>
    );
  }

  const points = strikeZonePoints(tracking, limit);
  if (!points.length) return null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Strike zone
          <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
            · catcher’s view · last {points.length}
          </span>
        </p>
        <p className="text-[10px] text-slate-400">
          <span className="mr-2 inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            in
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
            out
          </span>
        </p>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block rounded border border-slate-200 dark:border-slate-700"
        role="img"
        aria-label={`Strike zone plot of ${points.length} recent pitches`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ZoneFrame width={width} height={height} />
        {points
          .slice()
          .reverse()
          .map((p) => {
            const { x, y } = mapToSvg(p.side, p.height, width, height);
            const r = 3.2 + p.recency * 2.2;
            return (
              <circle
                key={p.key}
                cx={x}
                cy={y}
                r={r}
                opacity={0.35 + p.recency * 0.65}
                className={
                  p.inZone
                    ? "fill-red-500 dark:fill-red-400"
                    : "fill-sky-500 dark:fill-sky-400"
                }
              >
                <title>{p.label}</title>
              </circle>
            );
          })}
      </svg>
    </div>
  );
}
