"use client";

import type {
  WpblScheduleGame,
  WpblStandingRow,
} from "@/lib/types/wpbl-display";

import { DayGameCard } from "./DayGameCard";
import { FinalGameCard } from "./FinalGameCard";
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
    <div className="rounded-xl border border-dashed border-[var(--wpbl-rule)] px-4 py-4 text-sm wpbl-muted">
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

function FinalGameDetailCard({
  game,
  standings,
}: {
  game: WpblScheduleGame;
  standings: WpblStandingRow[];
}) {
  const { data, loading } = useWpblLiveGame(game.id);

  if (data) {
    return <FinalGameCard detail={data} standings={standings} />;
  }

  // Schedule row while the detail blob loads (or if fetch soft-fails).
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--wpbl-rule)] px-4 py-4 text-sm wpbl-muted">
        Loading {game.awayAbbr} @ {game.homeAbbr}…
      </div>
    );
  }

  return <DayGameCard game={game} standings={standings} />;
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
      <h2 className="wpbl-section-label">{title}</h2>
      <div className="space-y-4">
        {games.map((game) => {
          if (game.status === "live") {
            return <LiveGameDetailCard key={game.id} game={game} />;
          }

          if (game.status === "final") {
            return (
              <FinalGameDetailCard
                key={game.id}
                game={game}
                standings={standings}
              />
            );
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
