"use client";

import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblLiveSituation,
} from "@/lib/types/wpbl-display";
import {
  atBatPitchLog,
  lineupFollowers,
  shortRunnerLabel,
} from "@/lib/wpbl-plays";

import { PitchLog } from "./PitchLog";
import { TeamLogo } from "./TeamLogo";
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

function BasesDiamond({ situation }: { situation: WpblLiveSituation }) {
  const baseClass = (on: boolean) =>
    `absolute h-5 w-5 rotate-45 border ${
      on
        ? "border-amber-500 bg-amber-400 dark:border-amber-200 dark:bg-amber-300"
        : "border-slate-400 bg-transparent"
    }`;

  const first = shortRunnerLabel(situation.runnerFirst);
  const second = shortRunnerLabel(situation.runnerSecond);
  const third = shortRunnerLabel(situation.runnerThird);

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
      {(first || second || third) && (
        <p className="max-w-[11rem] text-center text-[11px] leading-tight text-slate-500">
          {[
            third ? `3B ${third}` : null,
            second ? `2B ${second}` : null,
            first ? `1B ${first}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function TeamColumn({
  abbr,
  name,
  runs,
  align,
}: {
  abbr: string;
  name: string;
  runs: number | null;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2.5 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <TeamLogo abbr={abbr} size="lg" />
      <div className="min-w-0">
        <p className="text-lg font-semibold tracking-tight sm:text-xl">{abbr}</p>
        <p className="truncate text-xs text-slate-500">{name}</p>
      </div>
      <p className="shrink-0 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
        {runs == null ? "—" : runs}
      </p>
    </div>
  );
}

function PlayerLine({
  label,
  player,
  fallbackName,
  stats,
}: {
  label: string;
  player: WpblBoxPlayerLine | null;
  fallbackName?: string | null;
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

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
        {name}
      </p>
      {meta ? <p className="truncate text-xs text-slate-500">{meta}</p> : null}
    </div>
  );
}

export function GamedayScoreboard({ detail }: GamedayScoreboardProps) {
  const { game, boxscore } = detail;
  const situation = game.situation;
  const keys = keyPlayersFromDetail(detail);
  const followers = lineupFollowers(boxscore.batting, situation);
  const pitchLog = atBatPitchLog(situation, boxscore.plays);
  const isLive = game.status === "live";

  return (
    <div className="sticky top-0 z-20 -mx-1 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 sm:mx-0 sm:p-4">
      <div className="flex items-center gap-3">
        <TeamColumn
          abbr={game.awayAbbr}
          name={game.awayName}
          runs={game.awayRuns}
          align="left"
        />

        <div className="flex w-[7.5rem] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[8.5rem]">
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
          {situation ? <BasesDiamond situation={situation} /> : null}
          {situation &&
          (situation.balls != null || situation.strikes != null) ? (
            <p className="font-mono text-sm tabular-nums text-slate-700 dark:text-slate-200">
              {situation.balls ?? "—"}–{situation.strikes ?? "—"}
            </p>
          ) : null}
          {situation ? <OutsDots outs={situation.outs} /> : null}
        </div>

        <TeamColumn
          abbr={game.homeAbbr}
          name={game.homeName}
          runs={game.homeRuns}
          align="right"
        />
      </div>

      {(keys.pitcherName || keys.batterName || followers.onDeck) && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-4">
          <PlayerLine
            label="Pitching"
            player={null}
            fallbackName={keys.pitcherName}
            stats={keys.pitcherStats}
          />
          <PlayerLine
            label="At bat"
            player={followers.batter}
            fallbackName={keys.batterName}
            stats={keys.batterStats}
          />
          <PlayerLine label="On deck" player={followers.onDeck} />
          <PlayerLine label="In the hole" player={followers.inHole} />
        </div>
      )}

      {pitchLog.pitches.length > 0 ? (
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <PitchLog
            pitches={pitchLog.pitches}
            label={pitchLog.label}
            compact={false}
          />
        </div>
      ) : null}
    </div>
  );
}
