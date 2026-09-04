"use client";

import { useMemo } from "react";

import type { WpblScheduleGame } from "@/lib/types/wpbl-display";
import { buildTeamSeries } from "@/lib/wpbl-stats-enrichment";

import { TeamLogo } from "./TeamLogo";

export function TeamSeriesCards({ games }: { games: WpblScheduleGame[] }) {
  const series = useMemo(() => buildTeamSeries(games), [games]);

  if (series.length === 0) {
    return (
      <div className="wpbl-panel px-4 py-8 text-sm wpbl-muted">
        No completed series yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {series.map((row) => {
        const aLeads = row.aWins > row.bWins;
        const bLeads = row.bWins > row.aWins;
        return (
          <article
            key={`${row.teamA}-${row.teamB}`}
            className="wpbl-panel px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <TeamLogo abbr={row.teamA} size="md" />
                <span
                  className={`text-lg font-bold tabular-nums ${
                    aLeads ? "text-[var(--wpbl-ink)]" : "wpbl-muted"
                  }`}
                >
                  {row.aWins}
                </span>
                <span className="text-[11px] font-semibold wpbl-muted">
                  {row.teamA}
                </span>
              </div>
              <div className="shrink-0 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide wpbl-muted">
                  Series
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums text-[var(--wpbl-ink)]">
                  {row.aWins}–{row.bWins}
                  {row.ties > 0 ? `–${row.ties}` : ""}
                </p>
                <p className="mt-1 text-[10px] wpbl-muted">
                  {row.gamesPlayed} GP · {row.aRuns}–{row.bRuns} R
                </p>
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <TeamLogo abbr={row.teamB} size="md" />
                <span
                  className={`text-lg font-bold tabular-nums ${
                    bLeads ? "text-[var(--wpbl-ink)]" : "wpbl-muted"
                  }`}
                >
                  {row.bWins}
                </span>
                <span className="text-[11px] font-semibold wpbl-muted">
                  {row.teamB}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
