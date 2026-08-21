"use client";

import { useEffect, useState } from "react";

import type {
  WpblGameDetailResponse,
  WpblScheduleGame,
  WpblStandingRow,
} from "@/lib/types/wpbl-display";

import { LiveGameCard } from "./LiveGameCard";

export type LiveGamesSectionProps = {
  liveGames: WpblScheduleGame[];
  standings: WpblStandingRow[];
  /** Bumps when the parent league poll refreshes so live details reload. */
  refreshKey: number;
};

export function LiveGamesSection({
  liveGames,
  standings,
  refreshKey,
}: LiveGamesSectionProps) {
  const [details, setDetails] = useState<
    Record<string, WpblGameDetailResponse | undefined>
  >({});
  const [loading, setLoading] = useState(false);

  const ids = liveGames.map((g) => g.id).join(",");

  useEffect(() => {
    if (!ids) return;

    let cancelled = false;
    const gameIds = ids.split(",");

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
  }, [ids, refreshKey]);

  if (liveGames.length === 0) return null;

  const cards = liveGames
    .map((game) => details[game.id])
    .filter((d): d is WpblGameDetailResponse => Boolean(d));

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Live
      </h2>
      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-600">
          {loading
            ? "Loading live game…"
            : "Live game detected — waiting for box score."}
          <ul className="mt-2 space-y-1 text-xs">
            {liveGames.map((g) => (
              <li key={g.id}>
                {g.awayAbbr} @ {g.homeAbbr}
                {g.awayRuns != null && g.homeRuns != null
                  ? ` · ${g.awayRuns}–${g.homeRuns}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map((detail) => (
            <LiveGameCard
              key={detail.game.id}
              detail={detail}
              standings={standings}
            />
          ))}
        </div>
      )}
    </section>
  );
}
