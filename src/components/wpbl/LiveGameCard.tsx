"use client";

import Link from "next/link";

import type {
  WpblGameDetailResponse,
  WpblLiveSituation,
  WpblStandingRow,
} from "@/lib/types/wpbl-display";

import { LineScore } from "./LineScore";
import { TeamLogo } from "./TeamLogo";
import { keyPlayersFromDetail } from "./liveGameCard";

export type LiveGameCardProps = {
  detail: WpblGameDetailResponse;
  standings: WpblStandingRow[];
};

function recordFor(standings: WpblStandingRow[], abbr: string): string | null {
  const row = standings.find((s) => s.abbr === abbr);
  if (!row) return null;
  if (row.t > 0) return `${row.w}-${row.l}-${row.t}`;
  return `${row.w}-${row.l}`;
}

function BasesDiamond({ situation }: { situation: WpblLiveSituation }) {
  const baseClass = (on: boolean) =>
    `absolute h-3.5 w-3.5 rotate-45 border border-slate-400 ${
      on
        ? "bg-amber-400 border-amber-500 dark:bg-amber-300 dark:border-amber-200"
        : "bg-transparent"
    }`;

  return (
    <div
      className="relative mx-auto h-10 w-10"
      aria-label={[
        situation.onFirst ? "runner on first" : null,
        situation.onSecond ? "runner on second" : null,
        situation.onThird ? "runner on third" : null,
      ]
        .filter(Boolean)
        .join(", ") || "bases empty"}
    >
      {/* Second */}
      <span className={`${baseClass(situation.onSecond)} left-1/2 top-0 -translate-x-1/2`} />
      {/* Third */}
      <span className={`${baseClass(situation.onThird)} left-0 top-1/2 -translate-y-1/2`} />
      {/* First */}
      <span className={`${baseClass(situation.onFirst)} right-0 top-1/2 -translate-y-1/2`} />
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
  name,
  record,
  runs,
  align,
}: {
  abbr: string;
  name: string;
  record: string | null;
  runs: number | null;
  align: "left" | "right";
}) {
  const score = runs == null ? "—" : String(runs);
  const cluster = (
    <>
      <TeamLogo abbr={abbr} size="lg" />
      <span className="min-w-0">
        <span className="block text-lg font-semibold tracking-tight">{abbr}</span>
        <span className="block truncate text-xs text-slate-500">
          {name}
          {record ? ` · ${record}` : ""}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {cluster}
      <span className="shrink-0 text-3xl font-bold tabular-nums tracking-tight">{score}</span>
    </div>
  );
}

function KeyPlayer({
  label,
  teamAbbr,
  name,
  stats,
}: {
  label: string;
  teamAbbr: string | null;
  name: string | null;
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
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
        {teamAbbr ? ` (${teamAbbr})` : ""}
      </p>
      <p className="truncate text-sm font-semibold">{name}</p>
      {stats ? <p className="truncate text-xs text-slate-500">{stats}</p> : null}
    </div>
  );
}

export function LiveGameCard({ detail, standings }: LiveGameCardProps) {
  const { game, boxscore } = detail;
  const situation = game.situation;
  const keys = keyPlayersFromDetail(detail);
  const awayRecord = recordFor(standings, game.awayAbbr);
  const homeRecord = recordFor(standings, game.homeAbbr);

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
          </span>
          {game.venue ? (
            <span className="truncate text-xs text-slate-500">{game.venue}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <TeamSide
            abbr={game.awayAbbr}
            name={game.awayName}
            record={awayRecord}
            runs={game.awayRuns}
            align="left"
          />

          <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              {game.inning ?? "In progress"}
            </p>
            {situation ? <BasesDiamond situation={situation} /> : null}
            {situation &&
            (situation.balls != null || situation.strikes != null) ? (
              <p className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                {situation.balls ?? "—"} - {situation.strikes ?? "—"}
              </p>
            ) : null}
            {situation ? <OutsDots outs={situation.outs} /> : null}
          </div>

          <TeamSide
            abbr={game.homeAbbr}
            name={game.homeName}
            record={homeRecord}
            runs={game.homeRuns}
            align="right"
          />
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
            stats={keys.pitcherStats}
          />
          <KeyPlayer
            label="At bat"
            teamAbbr={keys.batterTeamAbbr}
            name={keys.batterName}
            stats={keys.batterStats}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
        <Link
          href={`/wpbl/games/${game.id}`}
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Gameday
        </Link>
        <Link
          href={`/wpbl/games/${game.id}`}
          className="text-slate-600 hover:underline dark:text-slate-300"
        >
          Box score
        </Link>
      </div>
    </article>
  );
}
