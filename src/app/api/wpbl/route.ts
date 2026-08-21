import { REDIS_KEYS } from "@/lib/config";
import {
  buildWpblLeague,
  refreshWpblLeague,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { getRedis } from "@/lib/redis";
import type { WpblLeagueResponse } from "@/lib/types/wpbl-display";
import { wpblApiErrorResponse } from "@/lib/wpbl-api-error";

export async function GET() {
  try {
    try {
      const cached = await getRedis().get<WpblLeagueResponse>(
        REDIS_KEYS.wpblLeague,
      );
      if (cached) {
        return Response.json(cached);
      }
    } catch {
      // Fall through to live build when Redis is unset/unreachable.
    }

    // Empty cache or no Redis: build live (and write if Redis works).
    const blob = await refreshWpblLeague().catch(() => buildWpblLeague());
    return Response.json(blob);
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
