import { formatWhenEt } from "@/lib/fetchers/mlb";
import type { WpblScheduleGame } from "@/lib/types/wpbl-display";
import { fetchWpblJson } from "./client";
import { mapWpblStatus } from "./status";
import { teamFromFullName, teamFromId } from "./teams";

interface WpblApiGame {
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
  return payload.games
    .map(mapWpblGame)
    .filter((game): game is WpblScheduleGame => game != null);
}

export function resolveSeasonId(payload: WpblGamesPayload): string | null {
  return payload.games[0]?.season_id ?? null;
}

export async function fetchWpblGames(): Promise<WpblScheduleGame[]> {
  const payload = await fetchWpblJson<WpblGamesPayload>("/v1/games");
  return mapWpblGames(payload);
}
