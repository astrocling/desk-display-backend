import { REDIS_KEYS, wpblGameKey } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type {
  WpblGameDetailResponse,
  WpblLeadersResponse,
  WpblLeagueResponse,
} from "@/lib/types/wpbl-display";
import { fetchWpblGameDetail } from "./boxscore";
import { fetchWpblJson } from "./client";
import {
  mapWpblGames,
  resolveSeasonId,
  type WpblGamesPayload,
} from "./games";
import { fetchWpblLeaders } from "./leaders";
import { fetchWpblStandings } from "./standings";
import { FALLBACK_SEASON_ID } from "./teams";

export { wpblGameKey };

/** Max age of a live game blob before refresh. */
export const WPBL_LIVE_TTL_MS = 45_000;

export function shouldRefreshWpblGame(
  blob: WpblGameDetailResponse,
  now: Date = new Date(),
): boolean {
  if (blob.game.status === "live") {
    const updatedMs = Date.parse(blob.updatedAt);
    if (!Number.isFinite(updatedMs)) {
      return true;
    }
    return now.getTime() - updatedMs >= WPBL_LIVE_TTL_MS;
  }

  if (!blob.boxscore.available) {
    return true;
  }

  return false;
}

export function mergeWpblLeagueBlob(
  fresh: WpblLeagueResponse,
  prior: WpblLeagueResponse | null,
): WpblLeagueResponse {
  if (!prior) return fresh;

  const merged = { ...fresh };
  if (fresh.standings.length === 0 && prior.standings.length > 0) {
    merged.standings = prior.standings;
  }
  if (fresh.games.length === 0 && prior.games.length > 0) {
    merged.games = prior.games;
  }
  return merged;
}

function leadersHasData(blob: WpblLeadersResponse): boolean {
  return (
    blob.batting.avg.length > 0 ||
    blob.batting.hr.length > 0 ||
    blob.batting.rbi.length > 0 ||
    blob.batting.h.length > 0 ||
    blob.pitching.era.length > 0 ||
    blob.pitching.so.length > 0 ||
    blob.pitching.w.length > 0 ||
    blob.pitching.sv.length > 0
  );
}

export function mergeWpblLeadersBlob(
  fresh: WpblLeadersResponse,
  prior: WpblLeadersResponse | null,
): WpblLeadersResponse {
  if (!prior || leadersHasData(fresh)) return fresh;
  if (!leadersHasData(prior)) return fresh;
  return prior;
}

async function softSetWpblLeague(blob: WpblLeagueResponse): Promise<void> {
  const redis = getRedis();
  const prior = await redis.get<WpblLeagueResponse>(REDIS_KEYS.wpblLeague);
  const merged = mergeWpblLeagueBlob(blob, prior);

  if (merged.games.length === 0 && merged.standings.length === 0) {
    if (prior) {
      return;
    }
  }
  await redis.set(REDIS_KEYS.wpblLeague, merged);
}

async function softSetWpblLeaders(blob: WpblLeadersResponse): Promise<void> {
  const redis = getRedis();
  const prior = await redis.get<WpblLeadersResponse>(REDIS_KEYS.wpblLeaders);
  const merged = mergeWpblLeadersBlob(blob, prior);

  if (!leadersHasData(merged)) {
    if (prior) {
      return;
    }
  }
  await redis.set(REDIS_KEYS.wpblLeaders, merged);
}

/** Build league snapshot from WPBL /v1 with no Redis dependency. */
export async function buildWpblLeague(): Promise<WpblLeagueResponse> {
  const payload = await fetchWpblJson<WpblGamesPayload>("/v1/games");
  const games = mapWpblGames(payload);
  const seasonId = resolveSeasonId(payload) ?? FALLBACK_SEASON_ID;
  const standings = await fetchWpblStandings(seasonId);

  return {
    updatedAt: new Date().toISOString(),
    seasonId,
    standings,
    games,
  };
}

/** Build leaders blob from WPBL /v1 with no Redis dependency. */
export async function buildWpblLeadersBlob(
  seasonId: string,
): Promise<WpblLeadersResponse> {
  const leaders = await fetchWpblLeaders(seasonId);
  return {
    ...leaders,
    updatedAt: new Date().toISOString(),
    seasonId,
  };
}

async function readPriorLeague(): Promise<WpblLeagueResponse | null> {
  try {
    return await getRedis().get<WpblLeagueResponse>(REDIS_KEYS.wpblLeague);
  } catch {
    return null;
  }
}

async function readPriorLeaders(): Promise<WpblLeadersResponse | null> {
  try {
    return await getRedis().get<WpblLeadersResponse>(REDIS_KEYS.wpblLeaders);
  } catch {
    return null;
  }
}

export async function refreshWpblLeague(): Promise<WpblLeagueResponse> {
  try {
    const blob = await buildWpblLeague();
    try {
      await softSetWpblLeague(blob);
    } catch {
      // Redis optional for local live fallback
    }
    return blob;
  } catch (error) {
    const prior = await readPriorLeague();
    if (prior) {
      return prior;
    }
    throw error;
  }
}

export async function refreshWpblLeaders(
  seasonId: string,
): Promise<WpblLeadersResponse> {
  try {
    const blob = await buildWpblLeadersBlob(seasonId);
    try {
      await softSetWpblLeaders(blob);
    } catch {
      // Redis optional for local live fallback
    }
    return blob;
  } catch (error) {
    const prior = await readPriorLeaders();
    if (prior) {
      return prior;
    }
    throw error;
  }
}

export async function refreshWpblGame(
  id: string,
): Promise<WpblGameDetailResponse> {
  const key = wpblGameKey(id);
  let prior: WpblGameDetailResponse | null = null;
  try {
    prior = await getRedis().get<WpblGameDetailResponse>(key);
  } catch {
    prior = null;
  }

  try {
    const detail = await fetchWpblGameDetail(id);
    const next =
      prior?.boxscore.available && !detail.boxscore.available
        ? { ...detail, boxscore: prior.boxscore }
        : detail;
    try {
      await getRedis().set(key, next);
    } catch {
      // Redis optional for local live fallback
    }
    return next;
  } catch (error) {
    if (prior) {
      return prior;
    }
    throw error;
  }
}
