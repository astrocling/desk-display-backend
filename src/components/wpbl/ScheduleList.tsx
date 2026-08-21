import Link from "next/link";

import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

export type ScheduleListProps = {
  games: WpblScheduleGame[];
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

export function ScheduleList({ games }: ScheduleListProps) {
  if (games.length === 0) {
    return <p className="text-sm text-slate-500">No games for this filter.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
      {games.map((game) => (
        <li key={game.id}>
          <Link
            href={`/wpbl/games/${game.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50"
          >
            <StatusBadge status={game.status} />
            <span className="min-w-[5.5rem] text-xs tabular-nums text-slate-500">
              {game.whenEt ?? "TBD"}
            </span>
            <span className="flex-1 text-sm">
              <span className="font-medium">{game.awayAbbr}</span>
              <span className="mx-1 text-slate-400">@</span>
              <span className="font-medium">{game.homeAbbr}</span>
              <span className="ml-2 text-slate-500">
                {game.awayName} at {game.homeName}
              </span>
            </span>
            <span className="font-mono text-sm tabular-nums">{scoreLine(game)}</span>
            {game.venue ? (
              <span className="w-full text-xs text-slate-500 sm:w-auto">{game.venue}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
