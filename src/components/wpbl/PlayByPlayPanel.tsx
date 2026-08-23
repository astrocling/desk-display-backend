"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { WpblBoxPlayerLine, WpblPlay } from "@/lib/types/wpbl-display";
import {
  basesFromPlay,
  battingTeamAbbr,
  buildPlayTimeline,
  formatBasesState,
  isAdministrativePlay,
  playFocusName,
  playTypeLabel,
} from "@/lib/wpbl-play-display";
import { findPlayerLine } from "@/lib/wpbl-player-match";
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

function headshotForName(
  name: string | null | undefined,
  play: WpblPlay,
  batting: WpblBoxPlayerLine[],
  awayAbbr: string,
  homeAbbr: string,
): { headshotUrl: string | null; teamAbbr: string | null } {
  const trimmed = name?.trim();
  if (!trimmed) return { headshotUrl: null, teamAbbr: null };
  const line = findPlayerLine(batting, trimmed);
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
  const focusName = playFocusName(play);
  const { headshotUrl, teamAbbr } = headshotForName(
    focusName,
    play,
    batting,
    awayAbbr,
    homeAbbr,
  );
  const pitches = pitchesFromPlay(play);
  // Keep pitch detail inside the play card — numbered rail nodes made
  // non-photo rows feel like a different, denser treatment.
  const showPitchList = !admin && pitches.length > 1;

  return (
    <li className="wpbl-timeline-group">
      <div className="wpbl-timeline-item">
        <TimelineNode>
          {focusName ? (
            <PlayerHeadshot
              name={focusName}
              headshotUrl={headshotUrl}
              teamAbbr={teamAbbr}
              size={44}
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
          {showPitchList ? (
            <ol className="wpbl-pitch-list">
              {pitches.map((pitch, index) => (
                <li key={`${play.sequence}-pitch-${pitch.sequence}`}>
                  <span className="wpbl-pitch-list__n">{index + 1}</span>
                  {pitchEventLabel(pitch)}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
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

function AtBatTimelineItem({
  batterName,
  roster,
}: {
  batterName: string;
  roster: ReturnType<typeof rosterFromBoxLines>;
}) {
  return (
    <li className="wpbl-timeline-item wpbl-timeline-item--at-bat">
      <TimelineNode>
        <span className="wpbl-timeline-dot wpbl-timeline-dot--at-bat" />
      </TimelineNode>
      <p className="wpbl-timeline-at-bat pb-4">
        Now batting · {linkifyPlayerNames(batterName, roster)}
      </p>
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

  const timelineItems = useMemo(
    () => buildPlayTimeline(visible),
    [visible],
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
        <div className="wpbl-timeline">
          <ul className="wpbl-timeline-list">
            {timelineItems.map((item) => {
              if (item.kind === "play") {
                return (
                  <PlayTimelineItem
                    key={`play-${item.play.sequence}`}
                    play={item.play}
                    batting={batting}
                    roster={roster}
                    awayAbbr={awayAbbr}
                    homeAbbr={homeAbbr}
                  />
                );
              }
              if (item.kind === "at_bat") {
                return (
                  <AtBatTimelineItem
                    key={`at-bat-${item.play.sequence}-${item.batterName}`}
                    batterName={item.batterName}
                    roster={roster}
                  />
                );
              }
              return (
                <BasesTimelineItem
                  key={`bases-${item.key}-${item.play.sequence}`}
                  play={item.play}
                />
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
