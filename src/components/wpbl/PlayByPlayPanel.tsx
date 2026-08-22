"use client";

import { useMemo, useState } from "react";

import type {
  WpblBoxPlayerLine,
  WpblPlay,
} from "@/lib/types/wpbl-display";
import { resolvePlayerIdFromBox } from "@/lib/wpbl-player-match";
import { filterWpblPlays, formatPlayInning } from "@/lib/wpbl-plays";

import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PlayerNameLink } from "./PlayerNameLink";
import { WpblFeedFilter } from "./WpblFeedFilter";

export type PlayByPlayPanelProps = {
  plays: WpblPlay[];
  batting?: WpblBoxPlayerLine[];
  pitching?: WpblBoxPlayerLine[];
};

function PlayRow({
  play,
  batting,
  pitching,
  roster,
}: {
  play: WpblPlay;
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
  roster: ReturnType<typeof rosterFromBoxLines>;
}) {
  return (
    <li
      className={`wpbl-feed-row ${
        play.isScoringPlay ? "wpbl-feed-row--scoring" : ""
      }`}
    >
      <div className="wpbl-feed-meta mb-1">
        <span>{formatPlayInning(play)}</span>
        {play.outs != null ? <span>{play.outs} out</span> : null}
        {play.isScoringPlay && play.runsScored > 0 ? (
          <span>
            {play.runsScored} run{play.runsScored === 1 ? "" : "s"}
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
    </li>
  );
}

export function PlayByPlayPanel({
  plays,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <WpblFeedFilter
          ariaLabel="Play filter"
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "All plays" },
            { value: "scoring", label: "Scoring" },
          ]}
        />
        <p className="shrink-0 pb-2 text-xs wpbl-muted">
          {visible.length} play{visible.length === 1 ? "" : "s"}
          {mode === "scoring" ? ` · ${plays.length} total` : ""}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm wpbl-muted">No scoring plays yet.</p>
      ) : (
        <ul className="wpbl-feed-list">
          {visible.map((play) => (
            <PlayRow
              key={play.sequence}
              play={play}
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
