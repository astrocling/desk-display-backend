import { formatWhenEt } from "@/lib/fetchers/mlb";
import type { WpblScheduleGame } from "@/lib/types/wpbl-display";
import { fetchWpblJson } from "./client";
import { mapWpblStatus } from "./status";
import { teamFromFullName, teamFromId } from "./teams";

export interface WpblApiGame {
  game_id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  status: string;
  scheduled_start?: string | null;
  venue?: string | null;
  counts_in_standings?: boolean;
  presto_data?: {
    score?: {
      away?: string | null;
      home?: string | null;
    };
  };
}

export interface WpblGamesPayload {
  count?: number;
  games: WpblApiGame[];
}

function parseScore(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveTeam(id: string, fullName: string) {
  return teamFromId(id) ?? teamFromFullName(fullName);
}

function mapWpblGame(game: WpblApiGame): WpblScheduleGame | null {
  const awayTeam = resolveTeam(game.away_team_id, game.away_team_name);
  const homeTeam = resolveTeam(game.home_team_id, game.home_team_name);
  if (!awayTeam || !homeTeam) return null;

  const status = mapWpblStatus(game.status);
  const startIso = game.scheduled_start ?? null;
  const whenEt =
    status === "scheduled" && startIso ? formatWhenEt(startIso) : null;
  const awayRuns =
    status === "scheduled"
      ? null
      : parseScore(game.presto_data?.score?.away);
  const homeRuns =
    status === "scheduled"
      ? null
      : parseScore(game.presto_data?.score?.home);

  return {
    id: game.game_id,
    status,
    startIso,
    whenEt,
    awayAbbr: awayTeam.abbr,
    homeAbbr: homeTeam.abbr,
    awayName: awayTeam.name,
    homeName: homeTeam.name,
    awayRuns,
    homeRuns,
    venue: game.venue?.trim() ? game.venue : null,
    countsInStandings: game.counts_in_standings ?? true,
  };
}

export function mapWpblGames(payload: WpblGamesPayload): WpblScheduleGame[] {
  return collapseDuplicateMatchups(
    payload.games
      .map(mapWpblGame)
      .filter((game): game is WpblScheduleGame => game != null),
  );
}

function statusRank(status: WpblScheduleGame["status"]): number {
  switch (status) {
    case "live":
      return 0;
    case "final":
      return 1;
    case "scheduled":
      return 2;
    default:
      return 3;
  }
}

function matchupDayKey(game: WpblScheduleGame): string {
  const day = game.startIso ? game.startIso.slice(0, 10) : "unknown";
  return `${game.awayAbbr}@${game.homeAbbr}|${day}`;
}

/** Prefer live > final > scheduled when the API emits ghost duplicate slots. */
export function collapseDuplicateMatchups(
  games: WpblScheduleGame[],
): WpblScheduleGame[] {
  const byMatchup = new Map<string, WpblScheduleGame>();
  for (const game of games) {
    const key = matchupDayKey(game);
    const existing = byMatchup.get(key);
    if (!existing) {
      byMatchup.set(key, game);
      continue;
    }
    const rankDiff = statusRank(game.status) - statusRank(existing.status);
    if (rankDiff < 0) {
      byMatchup.set(key, game);
    } else if (rankDiff === 0) {
      const gameStart = game.startIso ? Date.parse(game.startIso) : 0;
      const existingStart = existing.startIso ? Date.parse(existing.startIso) : 0;
      if (gameStart >= existingStart) byMatchup.set(key, game);
    }
  }
  return Array.from(byMatchup.values());
}

export function resolveSeasonId(payload: WpblGamesPayload): string | null {
  return payload.games[0]?.season_id ?? null;
}

/** WPBL defaults to 50 rows; paginate so late-season games are not truncated. */
const GAMES_PAGE_SIZE = 50;

export async function fetchWpblGamesPayload(): Promise<WpblGamesPayload> {
  const allGames: WpblApiGame[] = [];
  let offset = 0;

  while (true) {
    const query = new URLSearchParams({
      limit: String(GAMES_PAGE_SIZE),
      offset: String(offset),
    });
    const page = await fetchWpblJson<WpblGamesPayload>(
      `/v1/games?${query}`,
    );
    const batch = page.games ?? [];
    if (batch.length === 0) break;
    allGames.push(...batch);
    if (batch.length < GAMES_PAGE_SIZE) break;
    offset += batch.length;
  }

  return { count: allGames.length, games: allGames };
}

export async function fetchWpblGames(): Promise<WpblScheduleGame[]> {
  const payload = await fetchWpblGamesPayload();
  return mapWpblGames(payload);
}
