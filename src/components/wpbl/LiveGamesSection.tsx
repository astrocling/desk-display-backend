"use client";

import { useEffect, useState } from "react";

import type {
  WpblGameDetailResponse,
  WpblScheduleGame,
  WpblStandingRow,
} from "@/lib/types/wpbl-display";

import { DayGameCard } from "./DayGameCard";
import { LiveGameCard } from "./LiveGameCard";

export type TodaysGamesSectionProps = {
  games: WpblScheduleGame[];
  standings: WpblStandingRow[];
  /** Bumps when the parent league poll refreshes so live details reload. */
  refreshKey: number;
};

export function TodaysGamesSection({
  games,
  standings,
  refreshKey,
}: TodaysGamesSectionProps) {
  const liveGames = games.filter((g) => g.status === "live");
  const [details, setDetails] = useState<
    Record<string, WpblGameDetailResponse | undefined>
  >({});
  const [loading, setLoading] = useState(false);

  const liveIds = liveGames.map((g) => g.id).join(",");

  useEffect(() => {
    if (!liveIds) return;

    let cancelled = false;
    const gameIds = liveIds.split(",");

    void (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          gameIds.map(async (id) => {
            try {
              const res = await fetch(`/api/wpbl/games/${id}`);
              if (!res.ok) return [id, null] as const;
              const json = (await res.json()) as WpblGameDetailResponse;
              return [id, json] as const;
            } catch {
              return [id, null] as const;
            }
          }),
        );
        if (cancelled) return;
        const next: Record<string, WpblGameDetailResponse | undefined> = {};
        for (const [id, detail] of results) {
          if (detail && detail.game.status === "live") {
            next[id] = detail;
          }
        }
        setDetails(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liveIds, refreshKey]);

  if (games.length === 0) return null;

  const hasLive = liveGames.length > 0;
  const title = hasLive ? "Today · Live" : "Today";

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="space-y-4">
        {games.map((game) => {
          if (game.status === "live") {
            const detail = details[game.id];
            if (detail) {
              return (
                <LiveGameCard
                  key={game.id}
                  detail={detail}
                />
              );
            }
            return (
              <div
                key={game.id}
                className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-600"
              >
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
