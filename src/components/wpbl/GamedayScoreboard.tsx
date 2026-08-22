"use client";

import type { ReactNode } from "react";

import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblLiveSituation,
} from "@/lib/types/wpbl-display";
import { resolvePlayerIdFromBox } from "@/lib/wpbl-player-match";
import {
  lineupFollowers,
  shortRunnerLabel,
} from "@/lib/wpbl-plays";
import { buildPitchChips } from "@/lib/wpbl-tracking";

import { GameCardMatchup } from "./GameCardMatchup";
import { PitchLog } from "./PitchLog";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { keyPlayersFromDetail } from "./liveGameCard";

export type GamedayScoreboardProps = {
  detail: WpblGameDetailResponse;
};

function OutsDots({ outs }: { outs: number | null }) {
  const n = outs == null ? 0 : Math.min(3, Math.max(0, outs));
  return (
    <div className="flex items-center gap-1.5" aria-label={`${n} out`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Outs
      </span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${
            i < n
              ? "bg-red-600 dark:bg-red-500"
              : "border border-slate-400 bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

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
    `absolute h-5 w-5 rotate-45 border ${
      on
        ? "border-amber-500 bg-amber-400 dark:border-amber-200 dark:bg-amber-300"
        : "border-slate-400 bg-transparent"
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
      ? { key: "3b", node: <>3B {linkShort(situation.runnerThird, third)}</> }
      : null,
    second
      ? { key: "2b", node: <>2B {linkShort(situation.runnerSecond, second)}</> }
      : null,
    first
      ? { key: "1b", node: <>1B {linkShort(situation.runnerFirst, first)}</> }
      : null,
  ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative h-16 w-16"
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
        <p className="max-w-[11rem] text-center text-[11px] leading-tight text-slate-500">
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

function PlayerLine({
  label,
  player,
  fallbackName,
  fallbackPlayerId,
  fallbackHeadshotUrl,
  teamAbbr,
  stats,
}: {
  label: string;
  player: WpblBoxPlayerLine | null;
  fallbackName?: string | null;
  fallbackPlayerId?: string | null;
  fallbackHeadshotUrl?: string | null;
  teamAbbr?: string | null;
  stats?: string | null;
}) {
  const name = player?.name ?? fallbackName;
  if (!name) return null;
  const meta = [
    player?.uniform ? `#${player.uniform}` : null,
    player?.position,
    stats,
  ]
    .filter(Boolean)
    .join(" · ");
  const playerId = player?.playerId ?? fallbackPlayerId;
  const headshotUrl = player?.headshotUrl ?? fallbackHeadshotUrl ?? null;

  return (
    <div className="flex min-w-0 items-start gap-2">
      <PlayerHeadshot
        name={name}
        headshotUrl={headshotUrl}
        teamAbbr={teamAbbr}
        size={36}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          <PlayerNameLink
            playerId={playerId}
            name={name}
            className="font-semibold text-inherit underline-offset-2 hover:underline hover:text-[#41B6E6]"
          />
        </p>
        {meta ? <p className="truncate text-xs text-slate-500">{meta}</p> : null}
      </div>
    </div>
  );
}

export function GamedayScoreboard({ detail }: GamedayScoreboardProps) {
  const { game, boxscore } = detail;
  const situation = game.situation;
  const keys = keyPlayersFromDetail(detail);
  const followers = lineupFollowers(boxscore.batting, situation);
  const pitchLog = buildPitchChips(
    situation,
    boxscore.plays,
    boxscore.tracking ?? [],
  );
  const isLive = game.status === "live";

  return (
    <div className="sticky top-0 z-20 -mx-1 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 sm:mx-0 sm:p-4">
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
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                isLive
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {game.inning ??
                (game.status === "final"
                  ? "Final"
                  : (game.whenEt ?? "Pregame"))}
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
              <p className="font-mono text-sm tabular-nums text-slate-700 dark:text-slate-200">
                {situation.balls ?? "—"}–{situation.strikes ?? "—"}
              </p>
            ) : null}
            {situation ? <OutsDots outs={situation.outs} /> : null}
          </>
        }
      />

      {(keys.pitcherName || keys.batterName || followers.onDeck) && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-4">
          <PlayerLine
            label="Pitching"
            player={
              keys.pitcherId
                ? (boxscore.pitching.find((p) => p.playerId === keys.pitcherId) ??
                  null)
                : null
            }
            fallbackName={keys.pitcherName}
            fallbackPlayerId={keys.pitcherId}
            teamAbbr={keys.pitcherTeamAbbr}
            stats={keys.pitcherStats}
          />
          <PlayerLine
            label="At bat"
            player={followers.batter}
            fallbackName={keys.batterName}
            fallbackPlayerId={keys.batterId}
            teamAbbr={keys.batterTeamAbbr}
            stats={keys.batterStats}
          />
          <PlayerLine
            label="On deck"
            player={followers.onDeck}
            teamAbbr={
              followers.battingSide === "away"
                ? game.awayAbbr
                : followers.battingSide === "home"
                  ? game.homeAbbr
                  : null
            }
          />
          <PlayerLine
            label="In the hole"
            player={followers.inHole}
            teamAbbr={
              followers.battingSide === "away"
                ? game.awayAbbr
                : followers.battingSide === "home"
                  ? game.homeAbbr
                  : null
            }
          />
        </div>
      )}

      {pitchLog.chips.length > 0 ? (
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <PitchLog
            chips={pitchLog.chips}
            label={pitchLog.label}
            compact={false}
          />
        </div>
      ) : null}
    </div>
  );
}
