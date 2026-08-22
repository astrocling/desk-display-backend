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
import { WPBL_PANEL } from "@/lib/wpbl-board";

import { PlayerNameLink } from "./PlayerNameLink";
import { StrikeZonePlot } from "./StrikeZonePlot";

export type TrackingPanelProps = {
  tracking: WpblTrackingEvent[];
  batting?: WpblBoxPlayerLine[];
  pitching?: WpblBoxPlayerLine[];
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

function ModeFilter({
  mode,
  onChange,
}: {
  mode: TrackingFeedMode;
  onChange: (mode: TrackingFeedMode) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
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
          onClick={() => onChange(value)}
          className={
            mode === value ? "wpbl-chip wpbl-chip--active" : "wpbl-chip"
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
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
      className={`wpbl-feed-row ${isHit ? "wpbl-feed-row--highlight" : ""}`}
    >
      <div className="flex gap-2.5">
        {showZone ? (
          <StrikeZonePlot event={event} size="sm" className="mt-0.5" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="wpbl-feed-meta mb-1">
            <span>{formatTrackingInning(event)}</span>
            <span
              className={
                isHit ? "wpbl-badge wpbl-badge--scoring" : "wpbl-badge wpbl-badge--neutral"
              }
            >
              {isHit ? "Contact" : "Pitch"}
            </span>
            {clock ? (
              <span className="normal-case tracking-normal">{clock}</span>
            ) : null}
          </div>

          <p className="wpbl-feed-body">
            {batter ? (
              <PlayerNameLink
                playerId={resolveNameId(
                  batting,
                  pitching,
                  event.batterId,
                  event.batterName,
                )}
                name={batter}
                className="font-medium text-[var(--wpbl-ink)]"
              />
            ) : (
              <span className="wpbl-muted">Unknown batter</span>
            )}
            {pitcher ? (
              <>
                <span className="wpbl-muted"> vs </span>
                <PlayerNameLink
                  playerId={resolveNameId(
                    batting,
                    pitching,
                    event.pitcherId,
                    event.pitcherName,
                  )}
                  name={pitcher}
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
                    className={
                      chip.impact
                        ? "wpbl-metric-chip wpbl-metric-chip--impact"
                        : "wpbl-metric-chip"
                    }
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
      <p className="text-sm wpbl-muted">
        {isLive
          ? "Waiting for live TrackMan — this venue may not publish tracking for every game."
          : "No TrackMan data for this game."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`${WPBL_PANEL} p-3`}>
        <StrikeZonePlot tracking={tracking} />
      </div>

      <div className="wpbl-feed-toolbar">
        <p className="text-xs wpbl-muted">
          {visible.length} event{visible.length === 1 ? "" : "s"}
          {mode !== "all" ? ` · ${tracking.length} total` : ""}
        </p>
        <ModeFilter mode={mode} onChange={setMode} />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm wpbl-muted">
          No {mode === "hits" ? "contact" : "pitch"} events yet.
        </p>
      ) : (
        <ul className="wpbl-feed-list">
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
