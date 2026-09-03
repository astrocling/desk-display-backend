import { wpblGameKey } from "@/lib/config";
import { fetchWpblGameDetail } from "@/lib/fetchers/wpbl-v1/boxscore";
import { WpblHttpError } from "@/lib/fetchers/wpbl-v1/client";
import { normalizeWpblGameDetail } from "@/lib/fetchers/wpbl-v1/normalize-game-detail";
import {
  refreshWpblGame,
  shouldRefreshWpblGame,
  wpblGameMayBeLive,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { getRedis } from "@/lib/redis";
import { scheduleBackground } from "@/lib/schedule-background";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";
import { wpblApiErrorResponse } from "@/lib/wpbl-api-error";
import {
  jsonWithCache,
  WPBL_API_CACHE_CONTROL,
  WPBL_LIVE_API_CACHE_CONTROL,
} from "@/lib/wpbl-cache-headers";

export { normalizeWpblGameDetail };

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

function cacheControlFor(blob: WpblGameDetailResponse): string {
  return blob.game.status === "live" || wpblGameMayBeLive(blob.game)
    ? WPBL_LIVE_API_CACHE_CONTROL
    : WPBL_API_CACHE_CONTROL;
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
    const needsRefresh = !blob || shouldRefreshWpblGame(blob, now);
    const liveCapable = Boolean(blob && wpblGameMayBeLive(blob.game, { now }));

    // Finals/scheduled: SWR — return Redis and refresh in the background.
    // Live (or past-start) games: await upstream so the card cannot sit on a
    // Top-1 Redis snapshot while the game is in the 7th.
    if (blob && needsRefresh && redisOk && !liveCapable) {
      scheduleBackground(() => refreshWpblGame(id).then(() => undefined));
      const normalized = normalizeWpblGameDetail(blob);
      return jsonWithCache(normalized, cacheControlFor(normalized));
    }

    if (needsRefresh) {
      try {
        blob = redisOk
          ? await refreshWpblGame(id)
          : await fetchWpblGameDetail(id);
      } catch (error) {
        if (blob) {
          const normalized = normalizeWpblGameDetail(blob);
          return jsonWithCache(normalized, cacheControlFor(normalized));
        }
        return gameFetchErrorResponse(error);
      }
    }

    const normalized = normalizeWpblGameDetail(blob!);
    return jsonWithCache(normalized, cacheControlFor(normalized));
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
