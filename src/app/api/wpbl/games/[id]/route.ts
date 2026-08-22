import { wpblGameKey } from "@/lib/config";
import { fetchWpblGameDetail } from "@/lib/fetchers/wpbl-v1/boxscore";
import { WpblHttpError } from "@/lib/fetchers/wpbl-v1/client";
import {
  refreshWpblGame,
  shouldRefreshWpblGame,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { getRedis } from "@/lib/redis";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";
import { wpblApiErrorResponse } from "@/lib/wpbl-api-error";

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

function gameFetchErrorResponse(error: unknown): Response {
  if (error instanceof WpblHttpError) {
    if (error.status === 404) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    if (error.status === 429) {
      return Response.json(
        { error: "WPBL rate limited — wait a moment and retry." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: error.message },
      { status: 502 },
    );
  }
  const message = error instanceof Error ? error.message : "Game fetch failed";
  if (/failed: 404|Unknown WPBL game|Unmapped WPBL game/i.test(message)) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }
  if (/failed: 429/i.test(message)) {
    return Response.json(
      { error: "WPBL rate limited — wait a moment and retry." },
      { status: 503 },
    );
  }
  return Response.json({ error: message }, { status: 502 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    let blob: WpblGameDetailResponse | null = null;
    let redisOk = true;

    try {
      blob = await getRedis().get<WpblGameDetailResponse>(wpblGameKey(id));
    } catch {
      redisOk = false;
    }

    const now = new Date();
    if (!blob || shouldRefreshWpblGame(blob, now)) {
      try {
        blob = redisOk
          ? await refreshWpblGame(id)
          : await fetchWpblGameDetail(id);
      } catch (error) {
        if (blob) {
          return Response.json(normalizeWpblGameDetail(blob));
        }
        return gameFetchErrorResponse(error);
      }
    }

    return Response.json(normalizeWpblGameDetail(blob));
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
