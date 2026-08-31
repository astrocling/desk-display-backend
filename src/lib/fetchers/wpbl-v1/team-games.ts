import type { WpblApiGame, WpblGamesPayload } from "./games";
import { fetchWpblJson } from "./client";
import { FALLBACK_SEASON_ID, WPBL_TEAMS } from "./teams";

interface WpblTeamGameRow {
  game_id: string;
  scheduled_start?: string | null;
  opponent_team_id: string;
  opponent_team_name?: string | null;
  side: string;
  is_final?: boolean;
  runs?: number | null;
  opponent_runs?: number | null;
}

export interface WpblTeamGamesPayload {
  season_id?: string;
  team_id?: string;
  count?: number;
  games: WpblTeamGameRow[];
}

function teamGameToApiGame(
  teamId: string,
  row: WpblTeamGameRow,
  seasonId: string,
): WpblApiGame | null {
  if (!row.is_final || !row.game_id?.trim()) return null;

  const isHome = row.side.trim().toLowerCase() === "home";
  const homeTeamId = isHome ? teamId : row.opponent_team_id;
  const awayTeamId = isHome ? row.opponent_team_id : teamId;
  const homeTeam = WPBL_TEAMS[homeTeamId as keyof typeof WPBL_TEAMS];
  const awayTeam = WPBL_TEAMS[awayTeamId as keyof typeof WPBL_TEAMS];
  if (!homeTeam || !awayTeam) return null;

  const homeRuns = isHome ? row.runs : row.opponent_runs;
  const awayRuns = isHome ? row.opponent_runs : row.runs;

  return {
    game_id: row.game_id,
    season_id: seasonId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    home_team_name: homeTeam.fullName,
    away_team_name: awayTeam.fullName,
    status: "Final",
    scheduled_start: row.scheduled_start ?? null,
    counts_in_standings: true,
    presto_data: {
      score: {
        away: awayRuns == null ? null : String(awayRuns),
        home: homeRuns == null ? null : String(homeRuns),
      },
    },
  };
}

async function fetchTeamFinalApiGames(
  teamId: string,
  seasonId: string,
): Promise<WpblApiGame[]> {
  try {
    const payload = await fetchWpblJson<WpblTeamGamesPayload>(
      `/v1/teams/${encodeURIComponent(teamId)}/games?season_id=${encodeURIComponent(seasonId)}`,
    );
    return payload.games
      .map((row) => teamGameToApiGame(teamId, row, seasonId))
      .filter((game): game is WpblApiGame => game != null);
  } catch {
    return [];
  }
}

/**
 * The league /v1/games list often keeps ghost "Not Started" slots while the
 * completed game lives only on /v1/teams/{id}/games. Merge those finals in.
 */
export async function fetchMissingFinalApiGames(
  listPayload: WpblGamesPayload,
  seasonId: string = FALLBACK_SEASON_ID,
): Promise<WpblApiGame[]> {
  const listedIds = new Set(listPayload.games.map((game) => game.game_id));
  const teamIds = Object.keys(WPBL_TEAMS);

  const perTeam = await Promise.all(
    teamIds.map((id) => fetchTeamFinalApiGames(id, seasonId)),
  );

  const seen = new Set<string>();
  const extras: WpblApiGame[] = [];
  for (const games of perTeam) {
    for (const game of games) {
      if (listedIds.has(game.game_id) || seen.has(game.game_id)) continue;
      seen.add(game.game_id);
      extras.push(game);
    }
  }
  return extras;
}
