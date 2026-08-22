"use client";

import { useMemo, useState } from "react";

import type {
  WpblBoxPlayerLine,
  WpblPlay,
  WpblTrackingEvent,
} from "@/lib/types/wpbl-display";
import { resolvePlayerIdFromBox } from "@/lib/wpbl-player-match";
import { filterWpblPlays, formatPlayInning } from "@/lib/wpbl-plays";
import { chipsForPlay } from "@/lib/wpbl-tracking";

import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PitchLog } from "./PitchLog";
import { PlayerNameLink } from "./PlayerNameLink";

export type PlayByPlayPanelProps = {
  plays: WpblPlay[];
  tracking?: WpblTrackingEvent[];
  batting?: WpblBoxPlayerLine[];
  pitching?: WpblBoxPlayerLine[];
};

function ModeFilter({
  mode,
  onChange,
}: {
  mode: "all" | "scoring";
  onChange: (mode: "all" | "scoring") => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Play filter">
      {(
        [
          ["all", "All"],
          ["scoring", "Scoring"],
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

function PlayRow({
  play,
  tracking,
  batting,
  pitching,
  roster,
}: {
  play: WpblPlay;
  tracking: WpblTrackingEvent[];
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
  roster: ReturnType<typeof rosterFromBoxLines>;
}) {
  const chips = chipsForPlay(play, tracking);

  return (
    <li
      className={`wpbl-feed-row ${
        play.isScoringPlay ? "wpbl-feed-row--highlight" : ""
      }`}
    >
      <div className="wpbl-feed-meta mb-1">
        <span>{formatPlayInning(play)}</span>
        {play.outs != null ? <span>{play.outs} out</span> : null}
        {play.isScoringPlay ? (
          <span className="wpbl-badge wpbl-badge--scoring">
            {play.runsScored > 0
              ? `${play.runsScored} run${play.runsScored === 1 ? "" : "s"}`
              : "Scoring"}
          </span>
        ) : null}
        {play.batterName ? (
          <span className="normal-case tracking-normal">
            AB{" "}
            <PlayerNameLink
              playerId={resolvePlayerIdFromBox(
                batting,
                pitching,
                play.batterName,
              )}
              name={play.batterName}
            />
          </span>
        ) : null}
        {play.pitcherName ? (
          <span className="normal-case tracking-normal">
            P{" "}
            <PlayerNameLink
              playerId={resolvePlayerIdFromBox(
                batting,
                pitching,
                play.pitcherName,
              )}
              name={play.pitcherName}
            />
          </span>
        ) : null}
      </div>
      <p className="wpbl-feed-body">
        {linkifyPlayerNames(play.narrative, roster)}
      </p>
      {chips.length > 0 ? (
        <div className="mt-1.5">
          <PitchLog chips={chips} compact />
        </div>
      ) : null}
    </li>
  );
}

export function PlayByPlayPanel({
  plays,
  tracking = [],
  batting = [],
  pitching = [],
}: PlayByPlayPanelProps) {
  const [mode, setMode] = useState<"all" | "scoring">("all");
  const visible = useMemo(() => filterWpblPlays(plays, mode), [plays, mode]);
  const roster = useMemo(
    () => rosterFromBoxLines(batting, pitching),
    [batting, pitching],
  );

  if (!plays.length) {
    return (
      <p className="text-sm wpbl-muted">
        Play-by-play will appear when the official feed publishes plays.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="wpbl-feed-toolbar">
        <p className="text-xs wpbl-muted">
          {visible.length} {mode === "scoring" ? "scoring " : ""}
          play{visible.length === 1 ? "" : "s"}
          {mode === "scoring" ? ` · ${plays.length} total` : ""}
        </p>
        <ModeFilter mode={mode} onChange={setMode} />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm wpbl-muted">No scoring plays yet.</p>
      ) : (
        <ul className="wpbl-feed-list">
          {visible.map((play) => (
            <PlayRow
              key={play.sequence}
              play={play}
              tracking={tracking}
              batting={batting}
              pitching={pitching}
              roster={roster}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
