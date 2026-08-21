import { wpblGameKey } from "@/lib/config";
import {
  refreshWpblGame,
  shouldRefreshWpblGame,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { getRedis } from "@/lib/redis";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const redis = getRedis();
  const key = wpblGameKey(id);
  let blob = await redis.get<WpblGameDetailResponse>(key);
  const now = new Date();

  if (!blob || shouldRefreshWpblGame(blob, now)) {
    try {
      blob = await refreshWpblGame(id);
    } catch {
      if (!blob) {
        return Response.json({ error: "Game not found" }, { status: 404 });
      }
    }
  }

  return Response.json(blob);
}
