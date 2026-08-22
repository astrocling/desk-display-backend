"use client";

import Link from "next/link";

import type {
  WpblGameDetailResponse,
  WpblStandingRow,
} from "@/lib/types/wpbl-display";
import { WPBL_LINK, WPBL_LINK_SUBTLE, WPBL_PANEL, WPBL_PANEL_FOOTER } from "@/lib/wpbl-board";
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
    <article className={WPBL_PANEL}>
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide wpbl-muted">
            Final
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
            <p className="text-sm font-semibold uppercase tracking-tight text-[var(--wpbl-ink-secondary)]">
              Final
            </p>
          }
        />
      </div>

      {boxscore.available && boxscore.lineScore ? (
        <div className={`px-2 py-2 ${WPBL_PANEL_FOOTER}`}>
          <LineScore lineScore={boxscore.lineScore} compact />
        </div>
      ) : null}

      {highlight ? (
        <div className={`px-4 py-2.5 ${WPBL_PANEL_FOOTER}`}>
          <p className="wpbl-section-label mb-0.5">
            {highlight.isScoringPlay ? "Last scoring play" : "Last play"}
          </p>
          <p className="line-clamp-2 text-sm leading-snug text-[var(--wpbl-ink-secondary)]">
            {linkifyPlayerNames(highlight.narrative, roster)}
          </p>
        </div>
      ) : null}

      <div
        className={`flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-sm ${WPBL_PANEL_FOOTER}`}
      >
        <Link href={`/wpbl/games/${game.id}`} className={WPBL_LINK}>
          Gameday
        </Link>
        <Link
          href={`/wpbl/games/${game.id}?view=box`}
          className={WPBL_LINK_SUBTLE}
        >
          Box score
        </Link>
        {hasTracking ? (
          <Link
            href={`/wpbl/games/${game.id}?view=trackman`}
            className={WPBL_LINK_SUBTLE}
          >
            TrackMan
          </Link>
        ) : null}
      </div>
    </article>
  );
}
