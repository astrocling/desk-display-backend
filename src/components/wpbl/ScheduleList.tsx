"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

import { TeamLogo } from "./TeamLogo";
import { partitionScheduleByWeek } from "./scheduleWeek";

export type ScheduleListProps = {
  games: WpblScheduleGame[];
  /** Injected for tests; defaults to now. */
  now?: Date;
  /**
   * `week` — this-week focus with expand (schedule page).
   * `flat` — render the given games as a simple list (home teaser).
   */
  variant?: "week" | "flat";
};

/** Split "Wed 8/12 6:30 PM" into date + time for a two-line status rail. */
function splitWhenEt(whenEt: string | null): {
  primary: string;
  secondary: string | null;
} {
  if (!whenEt) return { primary: "TBD", secondary: null };
  const match = whenEt.match(
    /^(.+?)\s+(\d{1,2}:\d{2}\s*[AP]M(?:\s*ET)?)$/i,
  );
  if (match) return { primary: match[1], secondary: match[2] };
  return { primary: whenEt, secondary: null };
}

function StatusRail({ game }: { game: WpblScheduleGame }) {
  if (game.status === "live") {
    return (
      <div className="flex flex-col items-start justify-center gap-0.5">
        <span className="wpbl-live-label">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
          </span>
          Live
        </span>
      </div>
    );
  }

  if (game.status === "final") {
    return (
      <div className="flex flex-col items-start justify-center">
        <span className="wpbl-section-label text-[11px]">
          Final
        </span>
      </div>
    );
  }

  if (game.status === "other") {
    return (
      <div className="flex flex-col items-start justify-center">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--wpbl-warning)" }}
        >
          TBD
        </span>
      </div>
    );
  }

  const { primary, secondary } = splitWhenEt(game.whenEt);
  return (
    <div className="flex flex-col items-start justify-center gap-0.5">
      <span className="text-[11px] font-medium tabular-nums text-[var(--wpbl-ink-secondary)]">
        {primary}
      </span>
      {secondary ? (
        <span className="text-[11px] tabular-nums wpbl-muted">
          {secondary}
        </span>
      ) : null}
    </div>
  );
}

function TeamLine({
  abbr,
  name,
  runs,
  showScore,
  isWinner,
}: {
  abbr: string;
  name: string;
  runs: number | null;
  showScore: boolean;
  isWinner: boolean;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_1.75rem] items-center gap-x-2">
      <TeamLogo abbr={abbr} size="sm" />
      <span
        className={`truncate text-sm tracking-tight ${
          isWinner
            ? "font-semibold text-[var(--wpbl-ink)]"
            : "font-medium text-[var(--wpbl-ink-secondary)]"
        }`}
      >
        {name}
      </span>
      <span
        className={`w-7 justify-self-end text-right font-mono text-sm tabular-nums ${
          isWinner
            ? "font-semibold text-[var(--wpbl-ink)]"
            : "wpbl-muted"
        }`}
      >
        {showScore ? (runs == null ? "—" : runs) : null}
      </span>
    </div>
  );
}

function GameRow({ game }: { game: WpblScheduleGame }) {
  const showScore =
    game.status === "live" ||
    game.status === "final" ||
    (game.awayRuns != null && game.homeRuns != null);
  const awayWins =
    game.status === "final" &&
    game.awayRuns != null &&
    game.homeRuns != null &&
    game.awayRuns > game.homeRuns;
  const homeWins =
    game.status === "final" &&
    game.awayRuns != null &&
    game.homeRuns != null &&
    game.homeRuns > game.awayRuns;

  return (
    <li>
      <Link
        href={`/wpbl/games/${game.id}`}
        className="block px-3.5 py-3 hover:bg-[var(--wpbl-bg-hover)]"
      >
        <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-x-3">
          {/* Match height of the two team lines so status stays optically centered */}
          <div className="flex min-h-[4.25rem] flex-col justify-center">
            <StatusRail game={game} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <TeamLine
              abbr={game.awayAbbr}
              name={game.awayName}
              runs={game.awayRuns}
              showScore={showScore}
              isWinner={awayWins}
            />
            <TeamLine
              abbr={game.homeAbbr}
              name={game.homeName}
              runs={game.homeRuns}
              showScore={showScore}
              isWinner={homeWins}
            />
          </div>
        </div>
        {game.venue ? (
          <p className="mt-1.5 truncate pl-[calc(4.75rem+0.75rem+2.5rem)] text-[11px] wpbl-muted">
            {game.venue}
          </p>
        ) : null}
      </Link>
    </li>
  );
}

function GameGroup({
  title,
  games,
}: {
  title: string;
  games: WpblScheduleGame[];
}) {
  if (games.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="wpbl-section-label">{title}</h3>
      <ul className="wpbl-table-wrap divide-y divide-[var(--wpbl-rule)]">
        {games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
      </ul>
    </div>
  );
}

export function ScheduleList({
  games,
  now,
  variant = "week",
}: ScheduleListProps) {
  const [expanded, setExpanded] = useState(false);
  const partition = useMemo(
    () => partitionScheduleByWeek(games, now ?? new Date()),
    [games, now],
  );

  if (games.length === 0) {
    return <p className="text-sm wpbl-muted">No games for this filter.</p>;
  }

  if (variant === "flat") {
    return (
      <ul className="wpbl-table-wrap divide-y divide-[var(--wpbl-rule)]">
        {games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
      </ul>
    );
  }

  const { past, thisWeek, future, weekLabel } = partition;
  const hiddenCount = past.length + future.length;
  const canExpand = hiddenCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--wpbl-ink-secondary)]">
          {expanded ? "Full schedule" : `This week · ${weekLabel}`}
        </p>
        {canExpand ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="wpbl-filter-btn"
          >
            {expanded
              ? "Show this week only"
              : `Show more (${hiddenCount} past & upcoming)`}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-6">
          <GameGroup title="Earlier" games={past} />
          <GameGroup title={`This week · ${weekLabel}`} games={thisWeek} />
          <GameGroup title="Upcoming" games={future} />
        </div>
      ) : thisWeek.length === 0 ? (
        <p className="text-sm wpbl-muted">
          No games scheduled Mon–Sun this week.
          {canExpand ? " Expand to see past and upcoming games." : null}
        </p>
      ) : (
        <ul className="wpbl-table-wrap divide-y divide-[var(--wpbl-rule)]">
          {thisWeek.map((game) => (
            <GameRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </div>
  );
}
