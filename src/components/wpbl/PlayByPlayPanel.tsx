"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { WpblBoxPlayerLine, WpblPlay } from "@/lib/types/wpbl-display";
import {
  basesFromPlay,
  basesStateKey,
  battingTeamAbbr,
  formatBasesState,
  isAdministrativePlay,
  playTypeLabel,
} from "@/lib/wpbl-play-display";
import {
  filterWpblPlays,
  formatPlayInning,
  pitchEventLabel,
  pitchesFromPlay,
} from "@/lib/wpbl-plays";

import { BasesStateIcon } from "./BasesStateIcon";
import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { WpblFeedFilter } from "./WpblFeedFilter";

export type PlayByPlayPanelProps = {
  plays: WpblPlay[];
  batting?: WpblBoxPlayerLine[];
  pitching?: WpblBoxPlayerLine[];
  awayAbbr?: string;
  homeAbbr?: string;
};

function batterHeadshot(
  play: WpblPlay,
  batting: WpblBoxPlayerLine[],
  awayAbbr: string,
  homeAbbr: string,
): { headshotUrl: string | null; teamAbbr: string | null } {
  const name = play.batterName?.trim();
  if (!name) return { headshotUrl: null, teamAbbr: null };
  const line = batting.find(
    (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
  );
  const teamAbbr =
    line?.side === "away"
      ? awayAbbr
      : line?.side === "home"
        ? homeAbbr
        : battingTeamAbbr(play, awayAbbr, homeAbbr);
  return {
    headshotUrl: line?.headshotUrl ?? null,
    teamAbbr,
  };
}

function PlayTypePill({ label }: { label: string }) {
  return <span className="wpbl-play-pill">{label}</span>;
}

function TimelineNode({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`wpbl-timeline-node ${className ?? ""}`.trim()}>
      {children}
    </div>
  );
}

function PlayTimelineItem({
  play,
  batting,
  roster,
  awayAbbr,
  homeAbbr,
}: {
  play: WpblPlay;
  batting: WpblBoxPlayerLine[];
  roster: ReturnType<typeof rosterFromBoxLines>;
  awayAbbr: string;
  homeAbbr: string;
}) {
  const admin = isAdministrativePlay(play);
  const label = admin ? null : playTypeLabel(play);
  const { headshotUrl, teamAbbr } = batterHeadshot(
    play,
    batting,
    awayAbbr,
    homeAbbr,
  );
  const pitches = pitchesFromPlay(play);

  return (
    <li className="wpbl-timeline-group">
      <div className="wpbl-timeline-item">
        <TimelineNode>
          {!admin && play.batterName ? (
            <PlayerHeadshot
              name={play.batterName}
              headshotUrl={headshotUrl}
              teamAbbr={teamAbbr}
              size={40}
            />
          ) : (
            <span className="wpbl-timeline-dot wpbl-timeline-dot--neutral" />
          )}
        </TimelineNode>
        <div className="wpbl-timeline-content min-w-0 pb-4">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {label ? <PlayTypePill label={label} /> : null}
            <span className="wpbl-timeline-meta">
              {formatPlayInning(play)}
              {play.outs != null ? ` · ${play.outs} out` : ""}
              {play.isScoringPlay && play.runsScored > 0
                ? ` · ${play.runsScored} run${play.runsScored === 1 ? "" : "s"}`
                : ""}
            </span>
          </div>
          <p className="wpbl-feed-body">
            {linkifyPlayerNames(play.narrative, roster)}
          </p>
        </div>
      </div>

      {pitches.length > 1
        ? pitches
            .slice()
            .reverse()
            .map((pitch, index) => (
              <div
                key={`${play.sequence}-pitch-${pitch.sequence}`}
                className="wpbl-timeline-item wpbl-timeline-item--pitch"
              >
                <TimelineNode>
                  <span className="wpbl-pitch-index">
                    {pitches.length - index}
                  </span>
                </TimelineNode>
                <p className="wpbl-timeline-pitch pb-3">
                  {pitchEventLabel(pitch)}
                </p>
              </div>
            ))
        : null}
    </li>
  );
}

function BasesTimelineItem({ play }: { play: WpblPlay }) {
  const bases = basesFromPlay(play);
  return (
    <li className="wpbl-timeline-item wpbl-timeline-item--bases">
      <TimelineNode>
        <BasesStateIcon bases={bases} size={22} />
      </TimelineNode>
      <p className="wpbl-timeline-bases pb-4">{formatBasesState(play)}</p>
    </li>
  );
}

export function PlayByPlayPanel({
  plays,
  batting = [],
  pitching = [],
  awayAbbr = "",
  homeAbbr = "",
}: PlayByPlayPanelProps) {
  const [mode, setMode] = useState<"all" | "scoring">("all");
  const visible = useMemo(() => filterWpblPlays(plays, mode), [plays, mode]);
  const roster = useMemo(
    () => rosterFromBoxLines(batting, pitching),
    [batting, pitching],
  );

  const timelineItems = useMemo(() => {
    const items: Array<
      | { kind: "play"; play: WpblPlay }
      | { kind: "bases"; play: WpblPlay; key: string }
    > = [];

    let lastBasesKey: string | null = null;

    for (let i = 0; i < visible.length; i += 1) {
      const play = visible[i]!;
      items.push({ kind: "play", play });

      const nextPlay = visible[i + 1];
      if (nextPlay) {
        const key = basesStateKey(nextPlay);
        if (key !== lastBasesKey) {
          items.push({ kind: "bases", play: nextPlay, key });
          lastBasesKey = key;
        }
      }
    }

    return items;
  }, [visible]);

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
        <div className="wpbl-timeline">
          <ul className="wpbl-timeline-list">
            {timelineItems.map((item) =>
              item.kind === "play" ? (
                <PlayTimelineItem
                  key={`play-${item.play.sequence}`}
                  play={item.play}
                  batting={batting}
                  roster={roster}
                  awayAbbr={awayAbbr}
                  homeAbbr={homeAbbr}
                />
              ) : (
                <BasesTimelineItem
                  key={`bases-${item.key}-${item.play.sequence}`}
                  play={item.play}
                />
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
