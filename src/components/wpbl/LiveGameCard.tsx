"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblLiveSituation,
} from "@/lib/types/wpbl-display";
import { resolvePlayerIdFromBox } from "@/lib/wpbl-player-match";
import type { WpblLiveConnection } from "@/lib/wpbl-live-ws";
import { latestWpblPlay, lineupFollowers, shortRunnerLabel } from "@/lib/wpbl-plays";
import { buildPitchChips } from "@/lib/wpbl-tracking";

import { GameCardMatchup } from "./GameCardMatchup";
import { LineScore } from "./LineScore";
import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PitchLog } from "./PitchLog";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { keyPlayersFromDetail } from "./liveGameCard";
import { WPBL_LINK, WPBL_LINK_SUBTLE, WPBL_PANEL, WPBL_PANEL_FOOTER } from "@/lib/wpbl-board";

export type LiveGameCardProps = {
  detail: WpblGameDetailResponse;
  /** Live websocket status when the card is driven by the official feed. */
  connection?: WpblLiveConnection;
};

function BasesDiamond({
  situation,
  batting,
  pitching,
}: {
  situation: WpblLiveSituation;
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
}) {
  const baseClass = (on: boolean) =>
    `absolute h-3.5 w-3.5 rotate-45 border border-slate-400 ${
      on
        ? "bg-amber-400 border-amber-500 dark:bg-amber-300 dark:border-amber-200"
        : "bg-transparent"
    }`;

  const linkShort = (full: string | null, short: string | null) => {
    if (!full || !short) return null;
    return (
      <PlayerNameLink
        playerId={resolvePlayerIdFromBox(batting, pitching, full)}
        name={short}
        className="underline-offset-2 hover:underline hover:text-[var(--wpbl-accent)]"
      />
    );
  };

  const first = shortRunnerLabel(situation.runnerFirst);
  const second = shortRunnerLabel(situation.runnerSecond);
  const third = shortRunnerLabel(situation.runnerThird);

  const bits = [
    third
      ? { key: "3", node: <>3:{linkShort(situation.runnerThird, third)}</> }
      : null,
    second
      ? { key: "2", node: <>2:{linkShort(situation.runnerSecond, second)}</> }
      : null,
    first
      ? { key: "1", node: <>1:{linkShort(situation.runnerFirst, first)}</> }
      : null,
  ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative mx-auto h-10 w-10"
        aria-label={[
          situation.runnerFirst
            ? `${situation.runnerFirst} on first`
            : situation.onFirst
              ? "runner on first"
              : null,
          situation.runnerSecond
            ? `${situation.runnerSecond} on second`
            : situation.onSecond
              ? "runner on second"
              : null,
          situation.runnerThird
            ? `${situation.runnerThird} on third`
            : situation.onThird
              ? "runner on third"
              : null,
        ]
          .filter(Boolean)
          .join(", ") || "bases empty"}
      >
        <span className={`${baseClass(situation.onSecond)} left-1/2 top-0 -translate-x-1/2`} />
        <span className={`${baseClass(situation.onThird)} left-0 top-1/2 -translate-y-1/2`} />
        <span className={`${baseClass(situation.onFirst)} right-0 top-1/2 -translate-y-1/2`} />
      </div>
      {bits.length > 0 ? (
        <p className="max-w-[7rem] truncate text-center text-[9px] leading-tight text-slate-500">
          {bits.map((bit, i) => (
            <span key={bit.key}>
              {i > 0 ? " · " : null}
              {bit.node}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function OutsDots({ outs }: { outs: number | null }) {
  const n = outs == null ? 0 : Math.min(3, Math.max(0, outs));
  return (
    <div className="flex items-center justify-center gap-1" aria-label={`${n} out`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < n
              ? "bg-red-600 dark:bg-red-500"
              : "border border-slate-400 bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function KeyPlayer({
  label,
  teamAbbr,
  name,
  playerId,
  headshotUrl,
  stats,
}: {
  label: string;
  teamAbbr: string | null;
  name: string | null;
  playerId: string | null;
  headshotUrl: string | null;
  stats: string | null;
}) {
  if (!name) {
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {label}
          {teamAbbr ? ` (${teamAbbr})` : ""}
        </p>
        <p className="text-sm text-slate-400">—</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-3">
      <PlayerHeadshot
        name={name}
        headshotUrl={headshotUrl}
        teamAbbr={teamAbbr}
        size={44}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {label}
          {teamAbbr ? ` (${teamAbbr})` : ""}
        </p>
        <p className="truncate text-sm font-semibold">
          <PlayerNameLink
            playerId={playerId}
            name={name}
            className="font-semibold text-inherit underline-offset-2 hover:underline hover:text-[var(--wpbl-accent)]"
          />
        </p>
        {stats ? <p className="truncate text-xs text-slate-500">{stats}</p> : null}
      </div>
    </div>
  );
}

export function LiveGameCard({ detail, connection }: LiveGameCardProps) {
  const { game, boxscore } = detail;
  const situation = game.situation;
  const keys = keyPlayersFromDetail(detail);
  const lastPlay = latestWpblPlay(boxscore.plays);
  const roster = rosterFromBoxLines(boxscore.batting, boxscore.pitching);
  const followers = lineupFollowers(boxscore.batting, situation);
  const pitchLog = buildPitchChips(
    situation,
    boxscore.plays,
    boxscore.tracking ?? [],
  );
  const onDeckTeamAbbr =
    followers.battingSide === "away"
      ? game.awayAbbr
      : followers.battingSide === "home"
        ? game.homeAbbr
        : null;

  return (
    <article className={WPBL_PANEL}>
      <div className={`px-4 py-3 ${WPBL_PANEL_FOOTER}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="wpbl-live-label">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            Live
            {connection === "live" ? (
              <span className="font-medium text-[var(--wpbl-accent)]">
                · feed
              </span>
            ) : connection === "reconnecting" || connection === "connecting" ? (
              <span
                className="font-medium"
                style={{ color: "var(--wpbl-warning)" }}
              >
                · syncing
              </span>
            ) : null}
          </span>
          {game.venue ? (
            <span className="truncate text-xs wpbl-muted">{game.venue}</span>
          ) : null}
        </div>

        <GameCardMatchup
          away={{
            abbr: game.awayAbbr,
            name: game.awayName,
            runs: game.awayRuns,
          }}
          home={{
            abbr: game.homeAbbr,
            name: game.homeName,
            runs: game.homeRuns,
          }}
          showScores
          center={
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {game.inning ?? "In progress"}
              </p>
              {situation ? (
                <BasesDiamond
                  situation={situation}
                  batting={boxscore.batting}
                  pitching={boxscore.pitching}
                />
              ) : null}
              {situation &&
              (situation.balls != null || situation.strikes != null) ? (
                <p className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {situation.balls ?? "—"} - {situation.strikes ?? "—"}
                </p>
              ) : null}
              {situation ? <OutsDots outs={situation.outs} /> : null}
            </>
          }
        />
      </div>

      {boxscore.available && boxscore.lineScore ? (
        <div className={WPBL_PANEL_FOOTER}>
          <LineScore
            lineScore={boxscore.lineScore}
            highlightInning={situation?.inningNumber}
            compact
          />
        </div>
      ) : null}

      {(keys.pitcherName || keys.batterName || followers.onDeck) && (
        <div className={`grid grid-cols-2 gap-4 px-4 py-3 sm:grid-cols-3 ${WPBL_PANEL_FOOTER}`}>
          <KeyPlayer
            label="Pitching"
            teamAbbr={keys.pitcherTeamAbbr}
            name={keys.pitcherName}
            playerId={keys.pitcherId}
            headshotUrl={keys.pitcherHeadshotUrl}
            stats={keys.pitcherStats}
          />
          <KeyPlayer
            label="At bat"
            teamAbbr={keys.batterTeamAbbr}
            name={keys.batterName}
            playerId={keys.batterId}
            headshotUrl={keys.batterHeadshotUrl}
            stats={keys.batterStats}
          />
          <KeyPlayer
            label="On deck"
            teamAbbr={onDeckTeamAbbr}
            name={followers.onDeck?.name ?? null}
            playerId={followers.onDeck?.playerId ?? null}
            headshotUrl={followers.onDeck?.headshotUrl ?? null}
            stats={
              followers.onDeck?.position
                ? followers.onDeck.position
                : null
            }
          />
        </div>
      )}

      {pitchLog.chips.length > 0 ? (
        <div className={`px-4 py-2.5 ${WPBL_PANEL_FOOTER}`}>
          <PitchLog
            chips={pitchLog.chips}
            label={pitchLog.label}
            compact
          />
        </div>
      ) : null}

      {lastPlay ? (
        <div className={`px-4 py-2.5 ${WPBL_PANEL_FOOTER}`}>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Latest play
            {lastPlay.isScoringPlay ? " · Scoring" : ""}
          </p>
          <p className="line-clamp-2 text-sm leading-snug text-slate-700 dark:text-slate-200">
            {linkifyPlayerNames(lastPlay.narrative, roster)}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
        <Link href={`/wpbl/games/${game.id}`} className={WPBL_LINK}>
          Gameday
        </Link>
        <Link
          href={`/wpbl/games/${game.id}?view=box`}
          className={WPBL_LINK_SUBTLE}
        >
          Box score
        </Link>
      </div>
    </article>
  );
}
