"use client";

import type { WpblLeadersResponse } from "@/lib/types/wpbl-display";

import {
  FEATURED_RACE_IDS,
  findCategory,
  rankAndFilterEntries,
} from "./leadersCategories";
import { PlayerNameLink } from "./PlayerNameLink";
import { teamAccentStyle } from "./teamAccent";

export type RacePickerProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
  activeCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
};

/**
 * Compact one-line race switcher: label + leader name/value.
 * Replaces the old multi-board featured grid.
 */
export function RacePicker({
  leaders,
  teamFilter,
  activeCategoryId,
  onSelectCategory,
}: RacePickerProps) {
  const boards = FEATURED_RACE_IDS.map((id) => findCategory(id)).filter(
    (c): c is NonNullable<typeof c> =>
      Boolean(c && c.getEntries(leaders).length > 0),
  );

  if (boards.length === 0) return null;

  return (
    <div
      className="wpbl-race-picker"
      role="listbox"
      aria-label="Stat race"
    >
      {boards.map((cat) => {
        const [leader] = rankAndFilterEntries(
          cat.getEntries(leaders),
          teamFilter,
          1,
        );
        const selected = activeCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelectCategory(cat.id)}
            className={
              selected
                ? "wpbl-race-picker__item wpbl-race-picker__item--active"
                : "wpbl-race-picker__item"
            }
          >
            <span className="wpbl-race-picker__stat">{cat.label}</span>
            {leader ? (
              <span
                className="wpbl-race-picker__leader wpbl-team-accent"
                style={teamAccentStyle(leader.teamAbbr)}
              >
                <span className="truncate">{leader.name.split(" ").pop()}</span>
                <span className="wpbl-race-picker__value tabular-nums">
                  {leader.value}
                </span>
              </span>
            ) : (
              <span className="wpbl-muted text-[11px]">—</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type RaceStandingsProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
  categoryId: string;
  limit?: number;
};

/** Slim top-N for the active race, shown under the chart. */
export function RaceStandings({
  leaders,
  teamFilter,
  categoryId,
  limit = 8,
}: RaceStandingsProps) {
  const cat = findCategory(categoryId);
  if (!cat) return null;
  const entries = rankAndFilterEntries(
    cat.getEntries(leaders),
    teamFilter,
    limit,
  );
  const leaderSort = cat.getEntries(leaders)[0]?.sortValue;
  const showLeagueRank = teamFilter !== "ALL";

  if (entries.length === 0) {
    return (
      <p className="px-1 py-3 text-sm wpbl-muted">
        No {cat.label} leaders for this filter.
      </p>
    );
  }

  return (
    <ol className="wpbl-panel">
      {entries.map((entry, i) => {
        const gapPct =
          cat.counting && leaderSort != null && leaderSort > 0
            ? Math.max(0, Math.min(100, (entry.sortValue / leaderSort) * 100))
            : null;
        return (
          <li
            key={entry.playerId}
            className="wpbl-team-accent border-b border-[var(--wpbl-rule)] last:border-b-0"
            style={teamAccentStyle(entry.teamAbbr)}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-4 shrink-0 text-right text-xs tabular-nums wpbl-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--wpbl-ink)]">
                <PlayerNameLink
                  playerId={entry.playerId}
                  name={entry.name}
                  className="text-inherit hover:text-[var(--wpbl-accent)] hover:underline"
                />
                <span className="ml-1.5 text-xs font-normal wpbl-muted">
                  {entry.teamAbbr}
                  {showLeagueRank && entry.leagueRank !== i + 1
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
  );
}
