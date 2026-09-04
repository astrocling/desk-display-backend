"use client";

import { useMemo, useState } from "react";

import type { WpblBoxPlayerLine, WpblPlay } from "@/lib/types/wpbl-display";
import {
  basesFromPlay,
  battingTeamAbbr,
  formatScoreLine,
  formatSituationalLine,
  groupPlaysByHalfInning,
  halfInningKey,
  isAdministrativePlay,
  playSummaryParts,
  playTypeLabel,
  runningScoresBySequence,
} from "@/lib/wpbl-play-display";
import {
  filterWpblPlays,
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

function PlaySummary({
  play,
  roster,
}: {
  play: WpblPlay;
  roster: ReturnType<typeof rosterFromBoxLines>;
}) {
  const { body, outsPhrase } = playSummaryParts(play);
  return (
    <p className="wpbl-play-summary">
      {linkifyPlayerNames(body, roster)}
      {outsPhrase ? (
        <>
          {" "}
          <strong className="wpbl-play-summary__outs">{outsPhrase}</strong>
        </>
      ) : null}
    </p>
  );
}

function PitchList({
  play,
  expanded,
  onToggle,
}: {
  play: WpblPlay;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pitches = pitchesFromPlay(play);
  if (pitches.length <= 1) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        className="wpbl-pitch-toggle"
        onClick={onToggle}
        aria-expanded={false}
      >
        {pitches.length} pitches
      </button>
    );
  }

  return (
    <div className="wpbl-pitch-block">
      <button
        type="button"
        className="wpbl-pitch-toggle"
        onClick={onToggle}
        aria-expanded
      >
        Hide pitches
      </button>
      <ol className="wpbl-pitch-list">
        {pitches.map((pitch, index) => (
          <li key={`${play.sequence}-pitch-${pitch.sequence}`}>
            <span className="wpbl-pitch-list__n">{index + 1}</span>
            {pitchEventLabel(pitch)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PlayCard({
  play,
  batting,
  roster,
  awayAbbr,
  homeAbbr,
  scoreLine,
  pitchesExpanded,
  onTogglePitches,
}: {
  play: WpblPlay;
  batting: WpblBoxPlayerLine[];
  roster: ReturnType<typeof rosterFromBoxLines>;
  awayAbbr: string;
  homeAbbr: string;
  scoreLine: string | null;
  pitchesExpanded: boolean;
  onTogglePitches: () => void;
}) {
  const admin = isAdministrativePlay(play);
  const label = admin ? null : playTypeLabel(play);
  const playerName = play.batterName?.trim() || null;
  const { headshotUrl, teamAbbr } = batterHeadshot(
    play,
    batting,
    awayAbbr,
    homeAbbr,
  );
  const situation = formatSituationalLine(play);
  const bases = basesFromPlay(play);

  return (
    <li className="wpbl-play-card">
      <div className="wpbl-play-card__avatar">
        {playerName ? (
          <PlayerHeadshot
            name={playerName}
            headshotUrl={headshotUrl}
            teamAbbr={teamAbbr}
            size={44}
          />
        ) : (
          <span className="wpbl-play-card__advisory" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </span>
        )}
      </div>
      <div className="wpbl-play-card__body">
        {situation ? (
          <div className="wpbl-play-situation">
            <BasesStateIcon bases={bases} size={18} />
            <span>{situation}</span>
          </div>
        ) : null}
        {label ? <PlayTypePill label={label} /> : null}
        {admin && !playerName ? (
          <p className="wpbl-play-advisory-label">Game Advisory</p>
        ) : null}
        <PlaySummary play={play} roster={roster} />
        {scoreLine ? <p className="wpbl-play-score">{scoreLine}</p> : null}
        {!admin ? (
          <PitchList
            play={play}
            expanded={pitchesExpanded}
            onToggle={onTogglePitches}
          />
        ) : null}
      </div>
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
  /** Explicit overrides; missing keys follow the current-inning default. */
  const [pitchOpen, setPitchOpen] = useState<Record<number, boolean>>({});

  const visible = useMemo(() => filterWpblPlays(plays, mode), [plays, mode]);
  const roster = useMemo(
    () => rosterFromBoxLines(batting, pitching),
    [batting, pitching],
  );

  const scoresBySequence = useMemo(
    () => runningScoresBySequence([...plays].sort((a, b) => a.sequence - b.sequence)),
    [plays],
  );

  const halfInnings = useMemo(
    () => groupPlaysByHalfInning(visible),
    [visible],
  );

  const currentHalfKey = useMemo(() => {
    const newest = visible[0];
    return newest ? halfInningKey(newest) : null;
  }, [visible]);

  const pitchesDefaultExpanded = (play: WpblPlay, halfKey: string) => {
    if (pitchOpen[play.sequence] != null) return pitchOpen[play.sequence]!;
    return halfKey === currentHalfKey;
  };

  const togglePitches = (sequence: number, halfKey: string) => {
    setPitchOpen((prev) => {
      const currently =
        prev[sequence] != null ? prev[sequence]! : halfKey === currentHalfKey;
      return { ...prev, [sequence]: !currently };
    });
  };

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
          variant="pills"
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "All" },
            { value: "scoring", label: "Scoring" },
          ]}
        />
        <p className="shrink-0 text-xs wpbl-muted">
          {visible.length} play{visible.length === 1 ? "" : "s"}
          {mode === "scoring" ? ` · ${plays.length} total` : ""}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm wpbl-muted">No scoring plays yet.</p>
      ) : (
        <div className="wpbl-gameday-feed">
          {halfInnings.map((group) => (
            <section key={group.key} className="wpbl-half-inning">
              <h3 className="wpbl-half-inning__label">{group.label}</h3>
              <ul className="wpbl-play-list">
                {group.plays.map((play) => {
                  const score = scoresBySequence.get(play.sequence);
                  const scoreLine =
                    !isAdministrativePlay(play) && score && awayAbbr && homeAbbr
                      ? formatScoreLine(score, awayAbbr, homeAbbr)
                      : null;
                  return (
                    <PlayCard
                      key={play.sequence}
                      play={play}
                      batting={batting}
                      roster={roster}
                      awayAbbr={awayAbbr}
                      homeAbbr={homeAbbr}
                      scoreLine={scoreLine}
                      pitchesExpanded={pitchesDefaultExpanded(play, group.key)}
                      onTogglePitches={() => togglePitches(play.sequence, group.key)}
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
