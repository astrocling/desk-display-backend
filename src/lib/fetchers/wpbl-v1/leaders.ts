import type { WpblLeaderEntry, WpblLeadersResponse } from "@/lib/types/wpbl-display";
import { formatWpblPosition } from "@/lib/wpbl-position";
import { fetchWpblJson } from "./client";
import {
  fetchWpblHeadshotMap,
  resolvePlayerHeadshot,
} from "./headshots";
import { FALLBACK_SEASON_ID, teamFromId, WPBL_TEAMS } from "./teams";

export const BATTING_MIN_AB = 10;
/** Stored per board in Redis; UI shows fewer after team filter. */
export const LEADERS_BOARD_STORE_LIMIT = 50;

export interface WpblPlayerSeasonInput {
  playerId: string;
  name: string;
  teamId: string;
  position?: string | null;
  headshotUrl?: string | null;
  batting: {
    at_bats: number;
    hits: number;
    home_runs: number;
    rbi: number;
  };
  pitching: {
    outs_pitched: number;
    era: number;
    strikeouts: number;
    wins: number;
    saves: number;
  };
}

export type WpblLeadersBuild = Omit<WpblLeadersResponse, "updatedAt" | "seasonId">;

interface WpblApiBatting {
  at_bats?: number;
  hits?: number;
  home_runs?: number;
  rbi?: number;
}

interface WpblApiPitching {
  outs_pitched?: number;
  era?: number;
  strikeouts?: number;
  wins?: number;
  saves?: number;
}

interface WpblApiPlayerStats {
  player_id: string;
  player_name?: string;
  batting?: WpblApiBatting;
  pitching?: WpblApiPitching;
}

interface WpblApiTeamPlayers {
  players: Array<{
    player_id: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    headshot_url?: string;
  }>;
}

function formatAvg(hits: number, atBats: number): string {
  return (hits / atBats).toFixed(3).replace(/^0/, "");
}

function formatEra(era: number): string {
  return era.toFixed(2);
}

function teamAbbr(teamId: string): string {
  return teamFromId(teamId)?.abbr ?? "??";
}

function buildBoard(
  players: WpblPlayerSeasonInput[],
  getEntry: (player: WpblPlayerSeasonInput) => { value: string; sortValue: number } | null,
  sort: "asc" | "desc" = "desc",
  limit = LEADERS_BOARD_STORE_LIMIT,
): WpblLeaderEntry[] {
  const entries = players
    .map((player) => {
      const stat = getEntry(player);
      if (!stat) return null;
      return {
        playerId: player.playerId,
        name: player.name,
        teamAbbr: teamAbbr(player.teamId),
        value: stat.value,
        sortValue: stat.sortValue,
        position: player.position ?? null,
        headshotUrl: player.headshotUrl ?? null,
      };
    })
    .filter((entry): entry is WpblLeaderEntry => entry != null);

  entries.sort((a, b) => {
    const diff =
      sort === "desc" ? b.sortValue - a.sortValue : a.sortValue - b.sortValue;
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  return entries.slice(0, limit);
}

export function buildWpblLeaders(players: WpblPlayerSeasonInput[]): WpblLeadersBuild {
  return {
    partial: false,
    qualifiers: { battingMinAb: BATTING_MIN_AB },
    batting: {
      avg: buildBoard(players, (player) => {
        if (player.batting.at_bats < BATTING_MIN_AB) return null;
        const sortValue = player.batting.hits / player.batting.at_bats;
        return {
          value: formatAvg(player.batting.hits, player.batting.at_bats),
          sortValue,
        };
      }),
      hr: buildBoard(players, (player) => ({
        value: String(player.batting.home_runs),
        sortValue: player.batting.home_runs,
      })),
      rbi: buildBoard(players, (player) => ({
        value: String(player.batting.rbi),
        sortValue: player.batting.rbi,
      })),
      h: buildBoard(players, (player) => ({
        value: String(player.batting.hits),
        sortValue: player.batting.hits,
      })),
    },
    pitching: {
      era: buildBoard(
        players,
        (player) => {
          if (player.pitching.outs_pitched <= 0) return null;
          return {
            value: formatEra(player.pitching.era),
            sortValue: player.pitching.era,
          };
        },
        "asc",
      ),
      so: buildBoard(players, (player) => ({
        value: String(player.pitching.strikeouts),
        sortValue: player.pitching.strikeouts,
      })),
      w: buildBoard(players, (player) => ({
        value: String(player.pitching.wins),
        sortValue: player.pitching.wins,
      })),
      sv: buildBoard(players, (player) => ({
        value: String(player.pitching.saves),
        sortValue: player.pitching.saves,
      })),
    },
  };
}

export function rosterPlayerName(player: WpblApiTeamPlayers["players"][number]): string {
  const first = player.first_name?.trim() ?? "";
  const last = player.last_name?.trim() ?? "";
  return `${first} ${last}`.trim();
}

export function mapPlayerStatsToInput(
  stats: WpblApiPlayerStats,
  teamId: string,
  fallbackName = "",
  extras?: { position?: string | null; headshotUrl?: string | null },
): WpblPlayerSeasonInput {
  const batting = stats.batting ?? {};
  const pitching = stats.pitching ?? {};
  const name = stats.player_name?.trim() || fallbackName.trim() || stats.player_id;

  return {
    playerId: stats.player_id,
    name,
    teamId,
    position: formatWpblPosition(extras?.position),
    headshotUrl: extras?.headshotUrl ?? null,
    batting: {
      at_bats: batting.at_bats ?? 0,
      hits: batting.hits ?? 0,
      home_runs: batting.home_runs ?? 0,
      rbi: batting.rbi ?? 0,
    },
    pitching: {
      outs_pitched: pitching.outs_pitched ?? 0,
      era: pitching.era ?? 0,
      strikeouts: pitching.strikeouts ?? 0,
      wins: pitching.wins ?? 0,
      saves: pitching.saves ?? 0,
    },
  };
}

export async function fetchWpblLeaders(
  seasonId: string = FALLBACK_SEASON_ID,
): Promise<WpblLeadersBuild> {
  const teamIds = Object.keys(WPBL_TEAMS);
  const [rosterResults, headshotMap] = await Promise.all([
    Promise.allSettled(
      teamIds.map((id) =>
        fetchWpblJson<WpblApiTeamPlayers>(`/v1/teams/${id}/players`),
      ),
    ),
    fetchWpblHeadshotMap(),
  ]);

  let partial = rosterResults.some((result) => result.status === "rejected");
  const playerJobs: Array<{
    playerId: string;
    teamId: string;
    fallbackName: string;
    position: string | null;
    rosterHeadshotUrl: string | null;
  }> = [];

  for (let i = 0; i < teamIds.length; i++) {
    const result = rosterResults[i];
    if (result.status !== "fulfilled") continue;

    const teamId = teamIds[i];
    for (const player of result.value.players) {
      const fallbackName = rosterPlayerName(player);
      playerJobs.push({
        playerId: player.player_id,
        teamId,
        fallbackName,
        position: formatWpblPosition(player.position),
        rosterHeadshotUrl: player.headshot_url?.trim() || null,
      });
    }
  }

  const statsResults = await Promise.allSettled(
    playerJobs.map((job) =>
      fetchWpblJson<WpblApiPlayerStats>(
        `/v1/players/${job.playerId}/stats?season_id=${seasonId}`,
      ),
    ),
  );

  if (statsResults.some((result) => result.status === "rejected")) {
    partial = true;
  }

  const players = statsResults.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const job = playerJobs[index];
    const name =
      result.value.player_name?.trim() || job.fallbackName || job.playerId;
    const headshotUrl = resolvePlayerHeadshot({
      playerId: job.playerId,
      name,
      rosterHeadshotUrl: job.rosterHeadshotUrl,
      headshotMap,
    });
    return [
      mapPlayerStatsToInput(result.value, job.teamId, job.fallbackName, {
        position: job.position,
        headshotUrl,
      }),
    ];
  });

  const leaders = buildWpblLeaders(players);
  return { ...leaders, partial };
}
