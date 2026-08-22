import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

/** Backfill fields added after older Redis game blobs were cached. */
export function normalizeWpblGameDetail(
  blob: WpblGameDetailResponse,
): WpblGameDetailResponse {
  const situation = blob.game.situation;
  const normalizeLine = <
    T extends {
      battingOrder?: number | null;
      uniform?: string | null;
      headshotUrl?: string | null;
    },
  >(
    line: T,
  ) => ({
    ...line,
    battingOrder: line.battingOrder ?? null,
    uniform: line.uniform ?? null,
    headshotUrl: line.headshotUrl ?? null,
  });

  return {
    ...blob,
    game: {
      ...blob.game,
      situation: situation
        ? {
            ...situation,
            runnerFirst: situation.runnerFirst ?? null,
            runnerSecond: situation.runnerSecond ?? null,
            runnerThird: situation.runnerThird ?? null,
          }
        : null,
    },
    boxscore: {
      ...blob.boxscore,
      plays: Array.isArray(blob.boxscore.plays) ? blob.boxscore.plays : [],
      batting: (blob.boxscore.batting ?? []).map(normalizeLine),
      pitching: (blob.boxscore.pitching ?? []).map(normalizeLine),
    },
  };
}
