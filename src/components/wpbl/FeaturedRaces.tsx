"use client";

import type { WpblLeadersResponse } from "@/lib/types/wpbl-display";
import { formatWpblPosition } from "@/lib/wpbl-position";

import {
  FEATURED_RACE_IDS,
  findCategory,
  rankAndFilterEntries,
} from "./leadersCategories";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { teamAccentStyle } from "./teamAccent";

const MINI_LIMIT = 5;

export type FeaturedRacesProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
  onSelectCategory: (categoryId: string) => void;
  activeCategoryId?: string;
};

export function FeaturedRaces({
  leaders,
  teamFilter,
  onSelectCategory,
  activeCategoryId,
}: FeaturedRacesProps) {
  const boards = FEATURED_RACE_IDS.map((id) => findCategory(id)).filter(
    (c): c is NonNullable<typeof c> =>
      Boolean(c && c.getEntries(leaders).length > 0),
  );

  if (boards.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {boards.map((cat) => {
        const entries = rankAndFilterEntries(
          cat.getEntries(leaders),
          teamFilter,
          MINI_LIMIT,
        );
        const leaderSort = cat.getEntries(leaders)[0]?.sortValue;
        const selected = activeCategoryId === cat.id;

        return (
          <article
            key={cat.id}
            className={`wpbl-panel wpbl-race-card ${
              selected ? "wpbl-race-card--active" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className="flex w-full items-baseline justify-between gap-2 border-b border-[var(--wpbl-rule)] px-3 py-2.5 text-left hover:bg-[var(--wpbl-bg-hover)]"
            >
              <span className="text-sm font-semibold text-[var(--wpbl-ink)]">
                {cat.label} race
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide wpbl-muted">
                Open →
              </span>
            </button>
            {entries.length === 0 ? (
              <p className="px-3 py-4 text-xs wpbl-muted">No leaders.</p>
            ) : (
              <ol>
                {entries.map((entry, i) => {
                  const gapPct =
                    cat.counting && leaderSort != null && leaderSort > 0
                      ? Math.max(
                          0,
                          Math.min(100, (entry.sortValue / leaderSort) * 100),
                        )
                      : null;
                  return (
                    <li
                      key={`${cat.id}-${entry.playerId}`}
                      className="wpbl-team-accent border-b border-[var(--wpbl-rule)] last:border-b-0"
                      style={teamAccentStyle(entry.teamAbbr)}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="w-3.5 shrink-0 text-right text-[11px] tabular-nums wpbl-muted">
                          {i + 1}
                        </span>
                        <PlayerHeadshot
                          name={entry.name}
                          headshotUrl={entry.headshotUrl}
                          teamAbbr={entry.teamAbbr}
                          size={28}
                        />
                        <span className="min-w-0 flex-1">
                          <PlayerNameLink
                            playerId={entry.playerId}
                            name={entry.name}
                            className="block truncate text-xs font-semibold text-[var(--wpbl-ink)]"
                          />
                          <span className="block truncate text-[10px] wpbl-muted">
                            {[formatWpblPosition(entry.position), entry.teamAbbr]
                              .filter(Boolean)
                              .join(" · ")}
                            {teamFilter !== "ALL" &&
                            entry.leagueRank !== i + 1
                              ? ` · #${entry.leagueRank}`
                              : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--wpbl-ink)]">
                          {entry.value}
                        </span>
                      </div>
                      {gapPct != null ? (
                        <div className="wpbl-race-gap px-3 pb-2">
                          <div
                            className="wpbl-race-gap__fill"
                            style={{ width: `${gapPct}%` }}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </article>
        );
      })}
    </div>
  );
}
