import { REDIS_KEYS, wpblPlayerKey } from "@/lib/config";
import {
  leadersBlobNeedsRebuild,
  normalizeWpblLeadersBlob,
} from "@/lib/fetchers/wpbl-v1/leaders";
import {
  buildWpblLeadersBlob,
  refreshWpblLeaders,
  refreshWpblPlayer,
} from "@/lib/fetchers/wpbl-v1/refresh";
import {
  buildWpblRacesBlob,
  racePlayerIdsToLoad,
} from "@/lib/fetchers/wpbl-v1/races";
import { FALLBACK_SEASON_ID } from "@/lib/fetchers/wpbl-v1/teams";
import { getRedis } from "@/lib/redis";
import type {
  WpblLeadersResponse,
  WpblPlayerDetailResponse,
  WpblRacesResponse,
} from "@/lib/types/wpbl-display";
import { wpblApiErrorResponse } from "@/lib/wpbl-api-error";
import { jsonWithCache, WPBL_API_CACHE_CONTROL } from "@/lib/wpbl-cache-headers";

const PER_RACE = 6;

async function resolveLeaders(): Promise<WpblLeadersResponse | null> {
  try {
    const cached = await getRedis().get<WpblLeadersResponse>(
      REDIS_KEYS.wpblLeaders,
    );
    if (cached && !leadersBlobNeedsRebuild(cached)) {
      return normalizeWpblLeadersBlob(cached);
    }
  } catch {
    // fall through
  }

  try {
    let seasonId = FALLBACK_SEASON_ID;
    try {
      const league = await getRedis().get<{ seasonId?: string }>(
        REDIS_KEYS.wpblLeague,
      );
      if (league?.seasonId) seasonId = league.seasonId;
    } catch {
      // keep fallback
    }
    const blob = await refreshWpblLeaders(seasonId).catch(() =>
      buildWpblLeadersBlob(seasonId),
    );
    return normalizeWpblLeadersBlob(blob);
  } catch {
    return null;
  }
}

async function loadPlayerDetail(
  id: string,
  seasonId: string,
): Promise<WpblPlayerDetailResponse | null> {
  const key = wpblPlayerKey(id);
  try {
    const cached = await getRedis().get<WpblPlayerDetailResponse>(key);
    if (cached?.gameLog?.length) return cached;
  } catch {
    // fall through
  }
  try {
    return await refreshWpblPlayer(id, seasonId);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const leaders = await resolveLeaders();
    if (!leaders) {
      return Response.json({ error: "leaders not ready" }, { status: 503 });
    }

    const ids = racePlayerIdsToLoad(leaders, PER_RACE);
    const playersById = new Map<string, WpblPlayerDetailResponse>();

    await Promise.all(
      ids.map(async (id) => {
        const detail = await loadPlayerDetail(id, leaders.seasonId);
        if (detail) playersById.set(id, detail);
      }),
    );

    const blob = buildWpblRacesBlob({
      leaders,
      playersById,
      perRace: PER_RACE,
    });

    const response: WpblRacesResponse = {
      ...blob,
      updatedAt: new Date().toISOString(),
    };

    return jsonWithCache(response, WPBL_API_CACHE_CONTROL);
  } catch (error) {
    return wpblApiErrorResponse(error);
  }
}
