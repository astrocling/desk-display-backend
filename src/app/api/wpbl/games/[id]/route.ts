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
          return Response.json(blob);
        }
        return gameFetchErrorResponse(error);
      }
    }

    return Response.json(blob);
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
