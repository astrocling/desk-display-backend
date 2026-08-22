"use client";

import { useMemo, useState } from "react";

import type {
  WpblBoxPlayerLine,
  WpblTrackingEvent,
} from "@/lib/types/wpbl-display";
import { resolvePlayerIdFromBox } from "@/lib/wpbl-player-match";
import {
  displayTrackingName,
  filterTrackingFeed,
  formatTrackingClock,
  formatTrackingInning,
  hasPlateLocation,
  trackingMetricChips,
  type TrackingFeedMode,
} from "@/lib/wpbl-tracking";

import { PlayerNameLink } from "./PlayerNameLink";
import { StrikeZonePlot } from "./StrikeZonePlot";

export type TrackingPanelProps = {
  tracking: WpblTrackingEvent[];
  batting?: WpblBoxPlayerLine[];
  pitching?: WpblBoxPlayerLine[];
  /** When true, game is still live — empty copy says tracking may connect. */
  isLive?: boolean;
};

function resolveNameId(
  batting: WpblBoxPlayerLine[],
  pitching: WpblBoxPlayerLine[],
  eventId: string | null,
  name: string | null,
): string | null {
  if (eventId?.trim()) return eventId.trim();
  return resolvePlayerIdFromBox(batting, pitching, name);
}

function TrackingRow({
  event,
  batting,
  pitching,
}: {
  event: WpblTrackingEvent;
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
}) {
  const chips = trackingMetricChips(event);
  const batter = displayTrackingName(event.batterName);
  const pitcher = displayTrackingName(event.pitcherName);
  const clock = formatTrackingClock(event.occurredAt);
  const isHit = event.kind === "hit";
  const showZone = hasPlateLocation(event);

  return (
    <li
      className={`border-b border-slate-100 px-3 py-2.5 last:border-b-0 dark:border-slate-800 ${
        isHit ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""
      }`}
    >
      <div className="flex gap-2.5">
        {showZone ? (
          <StrikeZonePlot event={event} size="sm" className="mt-0.5" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <span>{formatTrackingInning(event)}</span>
            {isHit ? (
              <span className="rounded bg-emerald-600 px-1 py-px text-[9px] font-semibold text-white">
                Contact
              </span>
            ) : (
              <span className="rounded bg-slate-600 px-1 py-px text-[9px] font-semibold text-white">
                Pitch
              </span>
            )}
            {clock ? (
              <span className="normal-case tracking-normal text-slate-400">
                {clock}
              </span>
            ) : null}
          </div>

          <p className="text-sm leading-snug text-slate-800 dark:text-slate-100">
            {batter ? (
              <PlayerNameLink
                playerId={resolveNameId(
                  batting,
                  pitching,
                  event.batterId,
                  event.batterName,
                )}
                name={batter}
                className="font-medium underline-offset-2 hover:underline hover:text-[#41B6E6]"
              />
            ) : (
              <span className="text-slate-500">Unknown batter</span>
            )}
            {pitcher ? (
              <>
                <span className="text-slate-400"> vs </span>
                <PlayerNameLink
                  playerId={resolveNameId(
                    batting,
                    pitching,
                    event.pitcherId,
                    event.pitcherName,
                  )}
                  name={pitcher}
                  className="underline-offset-2 hover:underline hover:text-[#41B6E6]"
                />
              </>
            ) : null}
          </p>

          {chips.length > 0 ? (
            <ul
              className="mt-1.5 flex flex-wrap gap-1"
              aria-label="TrackMan metrics"
            >
              {chips.map((chip) => (
                <li key={chip.text}>
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                      chip.impact
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                    }`}
                  >
                    {chip.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function TrackingPanel({
  tracking,
  batting = [],
  pitching = [],
  isLive = false,
}: TrackingPanelProps) {
  const [mode, setMode] = useState<TrackingFeedMode>("all");
  const visible = useMemo(
    () => filterTrackingFeed(tracking, mode),
    [tracking, mode],
  );

  if (!tracking.length) {
    return (
      <p className="text-sm text-slate-500">
        {isLive
          ? "Waiting for live TrackMan — this venue may not publish tracking for every game."
          : "No TrackMan data for this game."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <StrikeZonePlot tracking={tracking} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {visible.length} event{visible.length === 1 ? "" : "s"}
          {mode !== "all" ? ` · ${tracking.length} total` : ""}
        </p>
        <div
          className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700"
          role="group"
          aria-label="TrackMan filter"
        >
          {(
            [
              ["all", "All"],
              ["pitches", "Pitches"],
              ["hits", "Contact"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === value
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">
          No {mode === "hits" ? "contact" : "pitch"} events yet.
        </p>
      ) : (
        <ul className="max-h-[min(28rem,60vh)] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {visible.map((event) => (
            <TrackingRow
              key={event.activityId}
              event={event}
              batting={batting}
              pitching={pitching}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
