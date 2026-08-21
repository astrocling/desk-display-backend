"use client";

import Link from "next/link";

import type { WpblScheduleGame, WpblStandingRow } from "@/lib/types/wpbl-display";

import { TeamLogo } from "./TeamLogo";

export type DayGameCardProps = {
  game: WpblScheduleGame;
  standings: WpblStandingRow[];
};

function recordFor(standings: WpblStandingRow[], abbr: string): string | null {
  const row = standings.find((s) => s.abbr === abbr);
  if (!row) return null;
  if (row.t > 0) return `${row.w}-${row.l}-${row.t}`;
  return `${row.w}-${row.l}`;
}

function TeamBlock({
  abbr,
  name,
  record,
  runs,
  showScore,
  align,
}: {
  abbr: string;
  name: string;
  record: string | null;
  runs: number | null;
  showScore: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <TeamLogo abbr={abbr} size="lg" />
      <span className="min-w-0">
        <span className="block text-lg font-semibold tracking-tight">{abbr}</span>
        <span className="block truncate text-xs text-slate-500">
          {name}
          {record ? ` · ${record}` : ""}
        </span>
      </span>
      {showScore ? (
        <span className="shrink-0 text-3xl font-bold tabular-nums tracking-tight">
          {runs == null ? "—" : runs}
        </span>
      ) : null}
    </div>
  );
}

/** Compact MLB-style card for today's scheduled or final games. */
export function DayGameCard({ game, standings }: DayGameCardProps) {
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled" || game.status === "other";
  const awayRecord = recordFor(standings, game.awayAbbr);
  const homeRecord = recordFor(standings, game.homeAbbr);

  const centerLabel = isFinal
    ? "Final"
    : (game.whenEt ?? "TBD");

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isFinal
                ? "text-slate-500"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {isFinal ? "Final" : "Scheduled"}
          </span>
          {game.venue ? (
            <span className="truncate text-xs text-slate-500">{game.venue}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <TeamBlock
            abbr={game.awayAbbr}
            name={game.awayName}
            record={awayRecord}
            runs={game.awayRuns}
            showScore={isFinal}
            align="left"
          />

          <div className="flex w-[6.5rem] shrink-0 flex-col items-center gap-0.5 text-center">
            <p
              className={`text-sm font-semibold tracking-tight ${
                isScheduled
                  ? "text-slate-800 dark:text-slate-100"
                  : "uppercase text-slate-600 dark:text-slate-300"
              }`}
            >
              {centerLabel}
            </p>
            {isFinal && game.whenEt ? (
              <p className="text-[10px] text-slate-500">{game.whenEt}</p>
            ) : null}
          </div>

          <TeamBlock
            abbr={game.homeAbbr}
            name={game.homeName}
            record={homeRecord}
            runs={game.homeRuns}
            showScore={isFinal}
            align="right"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2.5 text-sm dark:border-slate-800">
        <Link
          href={`/wpbl/games/${game.id}`}
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Gameday
        </Link>
        {isFinal ? (
          <Link
            href={`/wpbl/games/${game.id}`}
            className="text-slate-600 hover:underline dark:text-slate-300"
          >
            Box score
          </Link>
        ) : null}
      </div>
    </article>
  );
}
