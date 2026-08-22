"use client";

import type {
  WpblScheduleGame,
  WpblStandingRow,
} from "@/lib/types/wpbl-display";

import { DayGameCard } from "./DayGameCard";
import { LiveGameCard } from "./LiveGameCard";
import { useWpblLiveGame } from "./useWpblLiveGame";

export type TodaysGamesSectionProps = {
  games: WpblScheduleGame[];
  standings: WpblStandingRow[];
  /** Kept for parent compatibility; live cards now refresh via websocket. */
  refreshKey: number;
};

function LiveGameDetailCard({
  game,
}: {
  game: WpblScheduleGame;
}) {
  const { data, loading, connection } = useWpblLiveGame(game.id);

  if (data && data.game.status === "live") {
    return <LiveGameCard detail={data} connection={connection} />;
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-600">
      {loading
        ? `Loading ${game.awayAbbr} @ ${game.homeAbbr}…`
        : `${game.awayAbbr} @ ${game.homeAbbr}${
            game.awayRuns != null && game.homeRuns != null
              ? ` · ${game.awayRuns}–${game.homeRuns}`
              : ""
          } — waiting for box score.`}
    </div>
  );
}

export function TodaysGamesSection({
  games,
  standings,
}: TodaysGamesSectionProps) {
  if (games.length === 0) return null;

  const hasLive = games.some((g) => g.status === "live");
  const title = hasLive ? "Today · Live" : "Today";

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="space-y-4">
        {games.map((game) => {
          if (game.status === "live") {
            return <LiveGameDetailCard key={game.id} game={game} />;
          }

          return (
            <DayGameCard key={game.id} game={game} standings={standings} />
          );
        })}
      </div>
    </section>
  );
}

/** @deprecated Prefer TodaysGamesSection */
export const LiveGamesSection = TodaysGamesSection;
