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

async function softSetWpblLeague(blob: WpblLeagueResponse): Promise<void> {
  const redis = getRedis();
  if (blob.games.length === 0 && blob.standings.length === 0) {
    const prior = await redis.get<WpblLeagueResponse>(REDIS_KEYS.wpblLeague);
    if (prior) {
      return;
    }
  }
  await redis.set(REDIS_KEYS.wpblLeague, blob);
}

async function softSetWpblLeaders(blob: WpblLeadersResponse): Promise<void> {
  const redis = getRedis();
  const hasData =
    blob.batting.avg.length > 0 ||
    blob.batting.hr.length > 0 ||
    blob.batting.rbi.length > 0 ||
    blob.batting.h.length > 0 ||
    blob.pitching.era.length > 0 ||
    blob.pitching.so.length > 0 ||
    blob.pitching.w.length > 0 ||
    blob.pitching.sv.length > 0;

  if (!hasData) {
    const prior = await redis.get<WpblLeadersResponse>(REDIS_KEYS.wpblLeaders);
    if (prior) {
      return;
    }
  }
  await redis.set(REDIS_KEYS.wpblLeaders, blob);
}

export async function refreshWpblLeague(): Promise<WpblLeagueResponse> {
  try {
    const payload = await fetchWpblJson<WpblGamesPayload>("/v1/games");
    const games = mapWpblGames(payload);
    const seasonId = resolveSeasonId(payload) ?? FALLBACK_SEASON_ID;
    const standings = await fetchWpblStandings(seasonId);

    const blob: WpblLeagueResponse = {
      updatedAt: new Date().toISOString(),
      seasonId,
      standings,
      games,
    };

    await softSetWpblLeague(blob);
    return blob;
  } catch (error) {
    const prior = await getRedis().get<WpblLeagueResponse>(REDIS_KEYS.wpblLeague);
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
    const leaders = await fetchWpblLeaders(seasonId);
    const blob: WpblLeadersResponse = {
      ...leaders,
      updatedAt: new Date().toISOString(),
      seasonId,
    };

    await softSetWpblLeaders(blob);
    return blob;
  } catch (error) {
    const prior = await getRedis().get<WpblLeadersResponse>(
      REDIS_KEYS.wpblLeaders,
    );
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
  const prior = await getRedis().get<WpblGameDetailResponse>(key);

  try {
    const detail = await fetchWpblGameDetail(id);
    const next =
      prior?.boxscore.available && !detail.boxscore.available
        ? { ...detail, boxscore: prior.boxscore }
        : detail;
    await getRedis().set(key, next);
    return next;
  } catch (error) {
    if (prior) {
      return prior;
    }
    throw error;
  }
}
