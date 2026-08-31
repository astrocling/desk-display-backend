import { REDIS_KEYS, wpblGameKey, wpblPlayerKey } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type {
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblLeadersResponse,
  WpblLeagueResponse,
  WpblPlayerDetailResponse,
  WpblScheduleGame,
} from "@/lib/types/wpbl-display";
import { fetchWpblGameDetail } from "./boxscore";
import { fetchWpblJson } from "./client";
import {
  mapWpblGames,
  resolveSeasonId,
  type WpblGamesPayload,
} from "./games";
import { fetchWpblLeaders } from "./leaders";
import { fetchWpblPlayerDetail } from "./player";
import { fetchWpblStandings } from "./standings";
import { fetchMissingFinalApiGames } from "./team-games";
import { FALLBACK_SEASON_ID } from "./teams";

export { wpblGameKey, wpblPlayerKey };

/** Max age of a live game blob before refresh. */
export const WPBL_LIVE_TTL_MS = 30_000;

/** Max age of the league blob before a live-capable on-read refresh. */
export const WPBL_LEAGUE_LIVE_TTL_MS = 30_000;

type WpblGameLiveProbe = {
  status: WpblGameStatus;
  startIso: string | null;
};

/** True when a schedule or detail row may be in progress but status is stale. */
export function wpblGameMayBeLive(
  game: WpblGameLiveProbe | null | undefined,
  options: { scheduleLive?: boolean; now?: Date } = {},
): boolean {
  if (!game) return Boolean(options.scheduleLive);
  if (game.status === "live") return true;
  if (options.scheduleLive) return true;
  if (
    (game.status === "scheduled" || game.status === "other") &&
    game.startIso
  ) {
    const now = options.now ?? new Date();
    const startMs = Date.parse(game.startIso);
    return Number.isFinite(startMs) && startMs <= now.getTime();
  }
  return false;
}

/** True when any game on the board may need live polling / refresh. */
export function wpblGamesNeedLivePoll(
  games: WpblScheduleGame[],
  now: Date = new Date(),
): boolean {
  return games.some((game) =>
    wpblGameMayBeLive(game, {
      scheduleLive: game.status === "live",
      now,
    }),
  );
}

export function shouldRefreshWpblLeague(
  blob: WpblLeagueResponse,
  now: Date = new Date(),
): boolean {
  const updatedMs = Date.parse(blob.updatedAt);
  if (!Number.isFinite(updatedMs)) {
    return true;
  }
  if (now.getTime() - updatedMs < WPBL_LEAGUE_LIVE_TTL_MS) {
    return false;
  }
  return wpblGamesNeedLivePoll(blob.games, now);
}

/** Max age of a player detail blob before on-read refresh. */
export const WPBL_PLAYER_TTL_MS = 5 * 60_000;

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

  if (wpblGameMayBeLive(blob.game, { now })) {
    return true;
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

function leadersBoardEntries(
  blob: WpblLeadersResponse,
): WpblLeadersResponse["batting"][keyof WpblLeadersResponse["batting"]][] {
  return [
    ...Object.values(blob.batting),
    ...Object.values(blob.pitching),
  ];
}

function leadersHasData(blob: WpblLeadersResponse): boolean {
  return leadersBoardEntries(blob).some((board) => board.length > 0);
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
  const seasonId = resolveSeasonId(payload) ?? FALLBACK_SEASON_ID;
  const missingFinals = await fetchMissingFinalApiGames(payload, seasonId);
  const games = mapWpblGames({
    ...payload,
    games: [...payload.games, ...missingFinals],
  });
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

export function shouldRefreshWpblPlayer(
  blob: WpblPlayerDetailResponse,
  now: Date = new Date(),
): boolean {
  const updatedMs = Date.parse(blob.updatedAt);
  if (!Number.isFinite(updatedMs)) {
    return true;
  }
  return now.getTime() - updatedMs >= WPBL_PLAYER_TTL_MS;
}

export async function refreshWpblPlayer(
  id: string,
  seasonId: string = FALLBACK_SEASON_ID,
): Promise<WpblPlayerDetailResponse> {
  const key = wpblPlayerKey(id);
  let prior: WpblPlayerDetailResponse | null = null;
  try {
    prior = await getRedis().get<WpblPlayerDetailResponse>(key);
  } catch {
    prior = null;
  }

  try {
    const detail = await fetchWpblPlayerDetail(id, seasonId);
    try {
      await getRedis().set(key, detail);
    } catch {
      // Redis optional for local live fallback
    }
    return detail;
  } catch (error) {
    if (prior) {
      return prior;
    }
    throw error;
  }
}

/** Unique player ids from the top of each leaders board (for cron warm). */
export function leaderPlayerIdsToWarm(
  leaders: WpblLeadersResponse,
  perBoard = 10,
): string[] {
  const boards = leadersBoardEntries(leaders);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const board of boards) {
    for (const entry of board.slice(0, perBoard)) {
      if (!entry.playerId || seen.has(entry.playerId)) continue;
      seen.add(entry.playerId);
      ids.push(entry.playerId);
    }
  }
  return ids;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, concurrency);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
}

/**
 * Prefetch player detail blobs so leader clicks are Redis-hot.
 * Soft-fails per player; never throws for individual upstream errors.
 */
export async function warmWpblPlayers(
  ids: string[],
  seasonId: string = FALLBACK_SEASON_ID,
  concurrency = 4,
): Promise<{ warmed: number; failed: number }> {
  let warmed = 0;
  let failed = 0;
  await mapPool(ids, concurrency, async (id) => {
    try {
      await refreshWpblPlayer(id, seasonId);
      warmed += 1;
    } catch {
      failed += 1;
    }
  });
  return { warmed, failed };
}
