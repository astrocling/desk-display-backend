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

export type RaceMatchupProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
  categoryId: string;
};

/** Format #1 lead over #2 from sortValue (counts or rates). */
export function formatRaceDelta(leaderSort: number, secondSort: number): string {
  const diff = Math.abs(leaderSort - secondSort);
  if (diff < 1e-9) return "tied";
  if (Number.isInteger(leaderSort) && Number.isInteger(secondSort)) {
    return `+${diff}`;
  }
  const decimals = diff < 0.1 ? 3 : 2;
  const trimmed = diff
    .toFixed(decimals)
    .replace(/\.?0+$/, "");
  return `+${trimmed}`;
}

/**
 * Compact #1 vs #2 strip for the active race.
 * Driven by the selected category + teamFilter (same ranking as RaceStandings).
 */
export function RaceMatchup({
  leaders,
  teamFilter,
  categoryId,
}: RaceMatchupProps) {
  const cat = findCategory(categoryId);
  if (!cat) return null;

  const entries = rankAndFilterEntries(
    cat.getEntries(leaders),
    teamFilter,
    2,
  );

  if (entries.length === 0) return null;

  if (entries.length === 1) {
    const alone = entries[0];
    return (
      <div
        className="wpbl-race-matchup wpbl-race-matchup--solo"
        aria-label={`${cat.label} race leader`}
      >
        <div
          className="wpbl-race-matchup__side wpbl-race-matchup__side--lead wpbl-team-accent"
          style={teamAccentStyle(alone.teamAbbr)}
        >
          <span className="wpbl-race-matchup__rank" aria-hidden>
            1
          </span>
          <div className="wpbl-race-matchup__meta min-w-0">
            <PlayerNameLink
              playerId={alone.playerId}
              name={alone.name}
              className="wpbl-race-matchup__name truncate"
            />
            <span className="wpbl-race-matchup__team">{alone.teamAbbr}</span>
          </div>
          <span className="wpbl-race-matchup__value tabular-nums">
            {alone.value}
          </span>
        </div>
        <p className="wpbl-race-matchup__hint wpbl-muted">
          No #2 under this filter
        </p>
      </div>
    );
  }

  const [first, second] = entries;
  const delta = formatRaceDelta(first.sortValue, second.sortValue);
  const tied = delta === "tied";
  const label = tied
    ? `${cat.label} race tied`
    : `${cat.label} race: ${first.name} leads by ${delta}`;

  return (
    <div className="wpbl-race-matchup" aria-label={label}>
      <div
        className={
          tied
            ? "wpbl-race-matchup__side wpbl-team-accent"
            : "wpbl-race-matchup__side wpbl-race-matchup__side--lead wpbl-team-accent"
        }
        style={teamAccentStyle(first.teamAbbr)}
      >
        <span className="wpbl-race-matchup__rank" aria-hidden>
          1
        </span>
        <div className="wpbl-race-matchup__meta min-w-0">
          <PlayerNameLink
            playerId={first.playerId}
            name={first.name}
            className="wpbl-race-matchup__name truncate"
          />
          <span className="wpbl-race-matchup__team">{first.teamAbbr}</span>
        </div>
        <span className="wpbl-race-matchup__value tabular-nums">
          {first.value}
        </span>
      </div>

      <div
        className={
          tied
            ? "wpbl-race-matchup__delta wpbl-race-matchup__delta--tied"
            : "wpbl-race-matchup__delta"
        }
        aria-hidden
      >
        {delta}
      </div>

      <div
        className="wpbl-race-matchup__side wpbl-race-matchup__side--trail wpbl-team-accent"
        style={teamAccentStyle(second.teamAbbr)}
      >
        <span className="wpbl-race-matchup__rank" aria-hidden>
          2
        </span>
        <div className="wpbl-race-matchup__meta min-w-0">
          <PlayerNameLink
            playerId={second.playerId}
            name={second.name}
            className="wpbl-race-matchup__name truncate"
          />
          <span className="wpbl-race-matchup__team">{second.teamAbbr}</span>
        </div>
        <span className="wpbl-race-matchup__value tabular-nums">
          {second.value}
        </span>
      </div>
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
