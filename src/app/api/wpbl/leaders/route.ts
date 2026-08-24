import { REDIS_KEYS } from "@/lib/config";
import { normalizeWpblLeadersBlob } from "@/lib/fetchers/wpbl-v1/leaders";
import {
  buildWpblLeadersBlob,
  buildWpblLeague,
  refreshWpblLeaders,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { FALLBACK_SEASON_ID } from "@/lib/fetchers/wpbl-v1/teams";
import { getRedis } from "@/lib/redis";
import type { WpblLeadersResponse } from "@/lib/types/wpbl-display";
import { wpblApiErrorResponse } from "@/lib/wpbl-api-error";
import { jsonWithCache, WPBL_API_CACHE_CONTROL } from "@/lib/wpbl-cache-headers";

async function resolveSeasonId(): Promise<string> {
  try {
    const league = await getRedis().get<{ seasonId?: string }>(
      REDIS_KEYS.wpblLeague,
    );
    if (league?.seasonId) return league.seasonId;
  } catch {
    // ignore
  }
  try {
    return (await buildWpblLeague()).seasonId;
  } catch {
    return FALLBACK_SEASON_ID;
  }
}

export async function GET() {
  try {
    try {
      const cached = await getRedis().get<WpblLeadersResponse>(
        REDIS_KEYS.wpblLeaders,
      );
      if (cached) {
        return jsonWithCache(
          normalizeWpblLeadersBlob(cached),
          WPBL_API_CACHE_CONTROL,
        );
      }
    } catch {
      // Fall through to live build when Redis is unset/unreachable.
    }

    const seasonId = await resolveSeasonId();
    const blob = await refreshWpblLeaders(seasonId).catch(() =>
      buildWpblLeadersBlob(seasonId),
    );
    return jsonWithCache(
      normalizeWpblLeadersBlob(blob),
      WPBL_API_CACHE_CONTROL,
    );
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
