import { REDIS_KEYS, wpblPlayerKey } from "@/lib/config";
import { WpblHttpError } from "@/lib/fetchers/wpbl-v1/client";
import {
  refreshWpblPlayer,
  shouldRefreshWpblPlayer,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { fetchWpblPlayerDetail } from "@/lib/fetchers/wpbl-v1/player";
import { FALLBACK_SEASON_ID } from "@/lib/fetchers/wpbl-v1/teams";
import { getRedis } from "@/lib/redis";
import type {
  WpblLeagueResponse,
  WpblPlayerDetailResponse,
} from "@/lib/types/wpbl-display";
import { wpblApiErrorResponse } from "@/lib/wpbl-api-error";

function playerFetchErrorResponse(error: unknown): Response {
  if (error instanceof WpblHttpError) {
    if (error.status === 404) {
      return Response.json({ error: "Player not found" }, { status: 404 });
    }
    if (error.status === 429) {
      return Response.json(
        { error: "WPBL rate limited — wait a moment and retry." },
        { status: 503 },
      );
    }
    return Response.json({ error: error.message }, { status: 502 });
  }
  const message =
    error instanceof Error ? error.message : "Player fetch failed";
  if (/failed: 404/i.test(message)) {
    return Response.json({ error: "Player not found" }, { status: 404 });
  }
  if (/failed: 429/i.test(message)) {
    return Response.json(
      { error: "WPBL rate limited — wait a moment and retry." },
      { status: 503 },
    );
  }
  return Response.json({ error: message }, { status: 502 });
}

async function resolveSeasonId(): Promise<string> {
  try {
    const league = await getRedis().get<WpblLeagueResponse>(
      REDIS_KEYS.wpblLeague,
    );
    if (league?.seasonId) return league.seasonId;
  } catch {
    // ignore
  }
  return FALLBACK_SEASON_ID;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return Response.json({ error: "Player not found" }, { status: 404 });
    }

    let blob: WpblPlayerDetailResponse | null = null;
    let redisOk = true;

    try {
      blob = await getRedis().get<WpblPlayerDetailResponse>(wpblPlayerKey(id));
    } catch {
      redisOk = false;
    }

    const now = new Date();
    if (!blob || shouldRefreshWpblPlayer(blob, now)) {
      try {
        const seasonId = blob?.seasonId ?? (await resolveSeasonId());
        blob = redisOk
          ? await refreshWpblPlayer(id, seasonId)
          : await fetchWpblPlayerDetail(id, seasonId);
      } catch (error) {
        if (blob) {
          return Response.json(blob);
        }
        return playerFetchErrorResponse(error);
      }
    }

    return Response.json(blob);
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
