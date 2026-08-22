"use client";

import Link from "next/link";

import type { WpblScheduleGame, WpblStandingRow } from "@/lib/types/wpbl-display";

import { GameCardMatchup } from "./GameCardMatchup";

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

/** Split "Wed 8/12 6:30 PM" into date + time for a two-line center stack. */
function splitWhenEt(whenEt: string): { primary: string; secondary: string | null } {
  const match = whenEt.match(
    /^(.+?)\s+(\d{1,2}:\d{2}\s*[AP]M(?:\s*ET)?)$/i,
  );
  if (match) return { primary: match[1], secondary: match[2] };
  return { primary: whenEt, secondary: null };
}

/** Compact MLB-style card for today's scheduled or final games. */
export function DayGameCard({ game, standings }: DayGameCardProps) {
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled" || game.status === "other";
  const awayRecord = recordFor(standings, game.awayAbbr);
  const homeRecord = recordFor(standings, game.homeAbbr);

  const whenParts =
    !isFinal && game.whenEt ? splitWhenEt(game.whenEt) : null;

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

        <GameCardMatchup
          away={{
            abbr: game.awayAbbr,
            name: game.awayName,
            record: awayRecord,
            runs: game.awayRuns,
          }}
          home={{
            abbr: game.homeAbbr,
            name: game.homeName,
            record: homeRecord,
            runs: game.homeRuns,
          }}
          showScores={isFinal}
          center={
            isFinal ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-tight text-slate-600 dark:text-slate-300">
                  Final
                </p>
                {game.whenEt ? (
                  <p className="text-[10px] text-slate-500">{game.whenEt}</p>
                ) : null}
              </>
            ) : (
              <>
                <p
                  className={`text-sm font-semibold tracking-tight ${
                    isScheduled
                      ? "text-slate-800 dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {whenParts?.primary ?? "TBD"}
                </p>
                {whenParts?.secondary ? (
                  <p className="text-xs tabular-nums text-slate-500">
                    {whenParts.secondary}
                  </p>
                ) : null}
              </>
            )
          }
        />
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
            href={`/wpbl/games/${game.id}?view=box`}
            className="text-slate-600 hover:underline dark:text-slate-300"
          >
            Box score
          </Link>
        ) : null}
      </div>
    </article>
  );
}
