import type { ScoresBlob } from "@/lib/types/scores";

/** Max age of an ESPN-backed scores blob before a live-capable refresh. */
export const SCORES_LIVE_TTL_MS = 45_000;

/**
 * Refresh when the blob is older than TTL and either already live or the
 * scheduled nextGame / WPBL start is at or before `now` (game may have started).
 */
export function shouldRefreshLiveScores(
  blob: ScoresBlob,
  now: Date = new Date(),
): boolean {
  const updatedMs = Date.parse(blob.updatedAt);
  if (!Number.isFinite(updatedMs)) {
    return true;
  }
  if (now.getTime() - updatedMs < SCORES_LIVE_TTL_MS) {
    return false;
  }

  if (blob.mlb.live) {
    return true;
  }

  if (blob.mlb.nextGame) {
    const startMs = Date.parse(blob.mlb.nextGame);
    if (Number.isFinite(startMs) && startMs <= now.getTime()) {
      return true;
    }
  }

  for (const game of blob.wpbl?.games ?? []) {
    if (game.status === "live") {
      return true;
    }
    if (game.startIso) {
      const startMs = Date.parse(game.startIso);
      if (Number.isFinite(startMs) && startMs <= now.getTime()) {
        return true;
      }
    }
  }

  return false;
}
