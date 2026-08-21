import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

/** Finals within this many days count as "recent" in schedule ordering. */
export const RECENT_FINAL_DAYS = 14;

export function isRecentFinal(game: WpblScheduleGame, now: Date): boolean {
  if (game.status !== "final" || !game.startIso) return false;
  const startMs = new Date(game.startIso).getTime();
  const cutoffMs = now.getTime() - RECENT_FINAL_DAYS * 24 * 60 * 60 * 1000;
  return startMs >= cutoffMs;
}

/** Primary tier (0 = first) and secondary sort key within tier. */
export function scheduleSortKey(
  game: WpblScheduleGame,
  now: Date,
): [tier: number, secondary: number] {
  const startMs = game.startIso ? new Date(game.startIso).getTime() : 0;

  if (game.status === "live") {
    return [0, startMs];
  }
  if (game.status === "scheduled") {
    return [1, startMs || Number.MAX_SAFE_INTEGER];
  }
  if (game.status === "final") {
    const tier = isRecentFinal(game, now) ? 2 : 3;
    return [tier, -startMs];
  }
  return [4, startMs];
}

export function compareWpblSchedule(
  a: WpblScheduleGame,
  b: WpblScheduleGame,
  now: Date = new Date(),
): number {
  const [tierA, secondaryA] = scheduleSortKey(a, now);
  const [tierB, secondaryB] = scheduleSortKey(b, now);
  if (tierA !== tierB) return tierA - tierB;
  return secondaryA - secondaryB;
}

export function sortWpblSchedule(
  games: WpblScheduleGame[],
  now: Date = new Date(),
): WpblScheduleGame[] {
  return [...games].sort((a, b) => compareWpblSchedule(a, b, now));
}
