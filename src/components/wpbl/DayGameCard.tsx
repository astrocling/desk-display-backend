"use client";

import Link from "next/link";

import type { WpblScheduleGame, WpblStandingRow } from "@/lib/types/wpbl-display";
import { WPBL_LINK, WPBL_LINK_SUBTLE, WPBL_PANEL, WPBL_PANEL_FOOTER } from "@/lib/wpbl-board";

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

function splitWhenEt(whenEt: string): { primary: string; secondary: string | null } {
  const match = whenEt.match(
    /^(.+?)\s+(\d{1,2}:\d{2}\s*[AP]M(?:\s*ET)?)$/i,
  );
  if (match) return { primary: match[1], secondary: match[2] };
  return { primary: whenEt, secondary: null };
}

export function DayGameCard({ game, standings }: DayGameCardProps) {
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled" || game.status === "other";
  const awayRecord = recordFor(standings, game.awayAbbr);
  const homeRecord = recordFor(standings, game.homeAbbr);
  const whenParts =
    !isFinal && game.whenEt ? splitWhenEt(game.whenEt) : null;

  return (
    <article className={WPBL_PANEL}>
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isFinal ? "wpbl-muted" : "text-[var(--wpbl-highlight)]"
            }`}
          >
            {isFinal ? "Final" : "Scheduled"}
          </span>
          {game.venue ? (
            <span className="truncate text-xs wpbl-muted">{game.venue}</span>
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
              <p className="text-sm font-semibold uppercase tracking-tight text-[var(--wpbl-ink-secondary)]">
                Final
              </p>
            ) : (
              <>
                <p
                  className={`text-sm font-semibold tracking-tight ${
                    isScheduled
                      ? "text-[var(--wpbl-ink)]"
                      : "text-[var(--wpbl-ink-secondary)]"
                  }`}
                >
                  {whenParts?.primary ?? "TBD"}
                </p>
                {whenParts?.secondary ? (
                  <p className="text-xs tabular-nums wpbl-muted">
                    {whenParts.secondary}
                  </p>
                ) : null}
              </>
            )
          }
        />
      </div>

      <div
        className={`flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-sm ${WPBL_PANEL_FOOTER}`}
      >
        <Link href={`/wpbl/games/${game.id}`} className={WPBL_LINK}>
          Gameday
        </Link>
        {isFinal ? (
          <Link
            href={`/wpbl/games/${game.id}?view=box`}
            className={WPBL_LINK_SUBTLE}
          >
            Box score
          </Link>
        ) : null}
      </div>
    </article>
  );
}
