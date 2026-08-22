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
import { latestWpblPlay, shortRunnerLabel } from "@/lib/wpbl-plays";

import { LineScore } from "./LineScore";
import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { TeamLogo } from "./TeamLogo";
import { keyPlayersFromDetail } from "./liveGameCard";

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
        className="underline-offset-2 hover:underline hover:text-[#41B6E6]"
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

function TeamSide({
  abbr,
  runs,
  align,
}: {
  abbr: string;
  runs: number | null;
  align: "left" | "right";
}) {
  const score = runs == null ? "—" : String(runs);

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <TeamLogo abbr={abbr} size="lg" />
      <span className="shrink-0 text-3xl font-bold tabular-nums tracking-tight">{score}</span>
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
    <div className="flex min-w-0 items-start gap-2">
      <PlayerHeadshot
        name={name}
        headshotUrl={headshotUrl}
        teamAbbr={teamAbbr}
        size={32}
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
            className="font-semibold text-inherit underline-offset-2 hover:underline hover:text-[#41B6E6]"
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

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            Live
            {connection === "live" ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                · feed
              </span>
            ) : connection === "reconnecting" || connection === "connecting" ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                · syncing
              </span>
            ) : null}
          </span>
          {game.venue ? (
            <span className="truncate text-xs text-slate-500">{game.venue}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <TeamSide abbr={game.awayAbbr} runs={game.awayRuns} align="left" />

          <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1 text-center">
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
          </div>

          <TeamSide abbr={game.homeAbbr} runs={game.homeRuns} align="right" />
        </div>
      </div>

      {boxscore.available && boxscore.lineScore ? (
        <div className="border-b border-slate-100 px-2 py-2 dark:border-slate-800">
          <LineScore
            lineScore={boxscore.lineScore}
            highlightInning={situation?.inningNumber}
            compact
          />
        </div>
      ) : null}

      {(keys.pitcherName || keys.batterName) && (
        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
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
        </div>
      )}

      {lastPlay ? (
        <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
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
        <Link
          href={`/wpbl/games/${game.id}`}
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Gameday
        </Link>
        <Link
          href={`/wpbl/games/${game.id}?view=box`}
          className="text-slate-600 hover:underline dark:text-slate-300"
        >
          Box score
        </Link>
      </div>
    </article>
  );
}
