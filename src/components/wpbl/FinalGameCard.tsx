"use client";

import Link from "next/link";

import type {
  WpblGameDetailResponse,
  WpblStandingRow,
} from "@/lib/types/wpbl-display";
import { latestWpblPlay } from "@/lib/wpbl-plays";

import { GameCardMatchup } from "./GameCardMatchup";
import { LineScore } from "./LineScore";
import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";

export type FinalGameCardProps = {
  detail: WpblGameDetailResponse;
  standings: WpblStandingRow[];
};

function recordFor(standings: WpblStandingRow[], abbr: string): string | null {
  const row = standings.find((s) => s.abbr === abbr);
  if (!row) return null;
  if (row.t > 0) return `${row.w}-${row.l}-${row.t}`;
  return `${row.w}-${row.l}`;
}

/** Today’s slate card for a completed game — line score + last play when cached. */
export function FinalGameCard({ detail, standings }: FinalGameCardProps) {
  const { game, boxscore } = detail;
  const awayRecord = recordFor(standings, game.awayAbbr);
  const homeRecord = recordFor(standings, game.homeAbbr);
  const awayWon =
    game.awayRuns != null &&
    game.homeRuns != null &&
    game.awayRuns > game.homeRuns;
  const homeWon =
    game.awayRuns != null &&
    game.homeRuns != null &&
    game.homeRuns > game.awayRuns;

  const lastPlay = latestWpblPlay(boxscore.plays);
  const lastScoring =
    [...boxscore.plays].reverse().find((p) => p.isScoringPlay) ?? null;
  const highlight = lastScoring ?? lastPlay;
  const roster = rosterFromBoxLines(boxscore.batting, boxscore.pitching);
  const hasTracking = (boxscore.tracking?.length ?? 0) > 0;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Final
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
            emphasize: awayWon,
          }}
          home={{
            abbr: game.homeAbbr,
            name: game.homeName,
            record: homeRecord,
            runs: game.homeRuns,
            emphasize: homeWon,
          }}
          showScores
          center={
            <>
              <p className="text-sm font-semibold uppercase tracking-tight text-slate-600 dark:text-slate-300">
                Final
              </p>
              {game.whenEt ? (
                <p className="text-[10px] text-slate-500">{game.whenEt}</p>
              ) : null}
            </>
          }
        />
      </div>

      {boxscore.available && boxscore.lineScore ? (
        <div className="border-t border-slate-100 px-2 py-2 dark:border-slate-800">
          <LineScore lineScore={boxscore.lineScore} compact />
        </div>
      ) : null}

      {highlight ? (
        <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {highlight.isScoringPlay ? "Last scoring play" : "Last play"}
          </p>
          <p className="line-clamp-2 text-sm leading-snug text-slate-700 dark:text-slate-200">
            {linkifyPlayerNames(highlight.narrative, roster)}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2.5 text-sm dark:border-slate-800">
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
        {hasTracking ? (
          <Link
            href={`/wpbl/games/${game.id}?view=trackman`}
            className="text-slate-600 hover:underline dark:text-slate-300"
          >
            TrackMan
          </Link>
        ) : null}
      </div>
    </article>
  );
}
