import { wpblGameMayBeLive } from "@/lib/fetchers/wpbl-v1/refresh";
import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

export type TodayGameCardKind = "live-detail" | "final-detail" | "day";

/** Which home-slate card to render for a game row. */
export function todayGameCardKind(
  game: WpblScheduleGame,
  now: Date = new Date(),
): TodayGameCardKind {
  if (game.status === "final") return "final-detail";

  const scheduleLive = game.status === "live";
  if (scheduleLive || wpblGameMayBeLive(game, { scheduleLive, now })) {
    return "live-detail";
  }
  return "day";
}

export function todaySlateHasLiveGame(
  games: WpblScheduleGame[],
): boolean {
  return games.some((game) => game.status === "live");
}
