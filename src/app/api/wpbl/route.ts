import { REDIS_KEYS } from "@/lib/config";
import {
  buildWpblLeague,
  refreshWpblLeague,
  shouldRefreshWpblLeague,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { getRedis } from "@/lib/redis";
import { scheduleBackground } from "@/lib/schedule-background";
import type { WpblLeagueResponse } from "@/lib/types/wpbl-display";
import { wpblApiErrorResponse } from "@/lib/wpbl-api-error";
import { jsonWithCache, WPBL_API_CACHE_CONTROL } from "@/lib/wpbl-cache-headers";

export async function GET() {
  try {
    try {
      const cached = await getRedis().get<WpblLeagueResponse>(
        REDIS_KEYS.wpblLeague,
      );
      if (cached) {
        if (shouldRefreshWpblLeague(cached)) {
          scheduleBackground(() => refreshWpblLeague().then(() => undefined));
        }
        return jsonWithCache(cached, WPBL_API_CACHE_CONTROL);
      }
    } catch {
      // Fall through to live build when Redis is unset/unreachable.
    }

    // Empty cache or no Redis: build live (and write if Redis works).
    const blob = await refreshWpblLeague().catch(() => buildWpblLeague());
    return jsonWithCache(blob, WPBL_API_CACHE_CONTROL);
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
