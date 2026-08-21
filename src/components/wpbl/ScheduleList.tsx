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
};

function StatusBadge({ status }: { status: WpblScheduleGame["status"] }) {
  const styles: Record<WpblScheduleGame["status"], string> = {
    live: "bg-red-600 text-white",
    final: "bg-slate-500 text-white dark:bg-slate-600",
    scheduled: "bg-emerald-600 text-white",
    other: "bg-amber-500 text-white",
  };
  const labels: Record<WpblScheduleGame["status"], string> = {
    live: "Live",
    final: "Final",
    scheduled: "Scheduled",
    other: "Other",
  };

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function scoreLine(game: WpblScheduleGame): string {
  if (game.status === "scheduled" || game.awayRuns == null || game.homeRuns == null) {
    return "—";
  }
  return `${game.awayRuns}–${game.homeRuns}`;
}

function GameRow({ game }: { game: WpblScheduleGame }) {
  return (
    <li>
      <Link
        href={`/wpbl/games/${game.id}`}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50"
      >
        <div className="flex flex-col items-start gap-1 self-center">
          <StatusBadge status={game.status} />
          <span className="text-[11px] tabular-nums text-slate-500">
            {game.whenEt ?? "TBD"}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            <span className="inline-flex items-center gap-1.5">
              <TeamLogo abbr={game.awayAbbr} size="md" />
              {game.awayAbbr}
            </span>
            <span className="text-slate-400" aria-hidden>
              @
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TeamLogo abbr={game.homeAbbr} size="md" />
              {game.homeAbbr}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {game.awayName} at {game.homeName}
            {game.venue ? ` · ${game.venue}` : ""}
          </p>
        </div>
        <span className="self-center font-mono text-sm tabular-nums">
          {scoreLine(game)}
        </span>
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
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
      </ul>
    </div>
  );
}

export function ScheduleList({ games, now }: ScheduleListProps) {
  const [expanded, setExpanded] = useState(false);
  const partition = useMemo(
    () => partitionScheduleByWeek(games, now ?? new Date()),
    [games, now],
  );

  if (games.length === 0) {
    return <p className="text-sm text-slate-500">No games for this filter.</p>;
  }

  const { past, thisWeek, future, weekLabel } = partition;
  const hiddenCount = past.length + future.length;
  const canExpand = hiddenCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {expanded ? "Full schedule" : `This week · ${weekLabel}`}
        </p>
        {canExpand ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
        <p className="text-sm text-slate-500">
          No games scheduled Mon–Sun this week.
          {canExpand ? " Expand to see past and upcoming games." : null}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {thisWeek.map((game) => (
            <GameRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </div>
  );
}
