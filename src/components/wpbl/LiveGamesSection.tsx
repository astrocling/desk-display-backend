"use client";

import { wpblGameMayBeLive } from "@/lib/fetchers/wpbl-v1/refresh";
import type {
  WpblScheduleGame,
  WpblStandingRow,
  WpblGameDetailResponse,
} from "@/lib/types/wpbl-display";

import { DayGameCard } from "./DayGameCard";
import { FinalGameCard } from "./FinalGameCard";
import { LiveGameCard } from "./LiveGameCard";
import {
  todayGameCardKind,
  todaySlateHasLiveGame,
} from "./todayGameCardKind";
import { useWpblLiveGame } from "./useWpblLiveGame";
import { WpblSectionTitle } from "./WpblBoardShell";

export type TodaysGamesSectionProps = {
  games: WpblScheduleGame[];
  standings: WpblStandingRow[];
  /** Override section heading (default derives from slate). */
  title?: string;
  /** Kept for parent compatibility; live cards now refresh via websocket. */
  refreshKey: number;
};

function detailForLiveCard(
  schedule: WpblScheduleGame,
  detail: WpblGameDetailResponse,
): WpblGameDetailResponse {
  const scheduleRuns =
    (schedule.awayRuns ?? 0) + (schedule.homeRuns ?? 0);
  const detailRuns =
    (detail.game.awayRuns ?? 0) + (detail.game.homeRuns ?? 0);
  // League schedule often advances score before the detail blob catches up.
  const useScheduleScore =
    schedule.awayRuns != null &&
    schedule.homeRuns != null &&
    scheduleRuns > detailRuns;

  const awayRuns = useScheduleScore
    ? schedule.awayRuns
    : (detail.game.awayRuns ?? schedule.awayRuns);
  const homeRuns = useScheduleScore
    ? schedule.homeRuns
    : (detail.game.homeRuns ?? schedule.homeRuns);

  if (detail.game.status === "live") {
    if (
      awayRuns === detail.game.awayRuns &&
      homeRuns === detail.game.homeRuns
    ) {
      return detail;
    }
    return {
      ...detail,
      game: {
        ...detail.game,
        awayRuns,
        homeRuns,
      },
    };
  }

  return {
    ...detail,
    game: {
      ...detail.game,
      status: "live",
      awayRuns,
      homeRuns,
    },
  };
}

function hasLiveCardData(detail: WpblGameDetailResponse): boolean {
  return (
    detail.game.status === "live" ||
    detail.game.situation != null ||
    detail.game.awayRuns != null ||
    detail.game.homeRuns != null ||
    detail.boxscore.available
  );
}

function LiveGameDetailCard({
  game,
}: {
  game: WpblScheduleGame;
}) {
  const mayBeLive = wpblGameMayBeLive(game, {
    scheduleLive: game.status === "live",
  });
  const { data, loading, connection } = useWpblLiveGame(game.id, {
    scheduleLive: mayBeLive,
  });

  if (data && (data.game.status === "live" || mayBeLive)) {
    const showCard =
      hasLiveCardData(data) ||
      game.awayRuns != null ||
      game.homeRuns != null;
    if (showCard) {
      return (
        <LiveGameCard
          detail={detailForLiveCard(game, data)}
          connection={connection}
        />
      );
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--wpbl-rule)] px-4 py-4 text-sm wpbl-muted">
      {loading
        ? `Loading ${game.awayAbbr} @ ${game.homeAbbr}…`
        : `${game.awayAbbr} @ ${game.homeAbbr}${
            game.awayRuns != null && game.homeRuns != null
              ? ` · ${game.awayRuns}–${game.homeRuns}`
              : ""
          } — syncing live data.`}
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
  title,
}: TodaysGamesSectionProps) {
  if (games.length === 0) return null;

  const hasLive = todaySlateHasLiveGame(games);
  const sectionTitle = title ?? (hasLive ? "Today · Live" : "Today");

  return (
    <section className="space-y-3">
      <WpblSectionTitle>{sectionTitle}</WpblSectionTitle>
      <div className="space-y-4">
        {games.map((game) => {
          const cardKind = todayGameCardKind(game);

          if (cardKind === "live-detail") {
            return <LiveGameDetailCard key={game.id} game={game} />;
          }

          if (cardKind === "final-detail") {
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
