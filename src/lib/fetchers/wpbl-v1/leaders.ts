import type {
  WpblLeaderEntry,
  WpblLeadersDataNote,
  WpblLeadersResponse,
} from "@/lib/types/wpbl-display";
import { formatWpblPosition } from "@/lib/wpbl-position";
import { fetchWpblJson } from "./client";
import {
  fetchWpblHeadshotMap,
  resolvePlayerHeadshot,
} from "./headshots";
import {
  computeObp,
  computeOps,
  computeSlg,
  computeWhip,
  formatRate,
  outsToIp,
} from "./player-rates";
import { FALLBACK_SEASON_ID, teamFromId, WPBL_TEAMS } from "./teams";

export const BATTING_MIN_AB = 10;
/** Minimum outs pitched for ERA / WHIP / IP boards (~3 IP). */
export const PITCHING_MIN_OUTS = 9;
/** Stored per board in Redis; UI shows fewer after team filter. */
export const LEADERS_BOARD_STORE_LIMIT = 50;

/**
 * Upstream season-stat fields that are unreliable in live WPBL payloads.
 * Do not rank from these; prefer counting fields + computed rates instead.
 */
export const WPBL_LEADERS_DATA_NOTES: WpblLeadersDataNote[] = [
  {
    field: "batting.plate_appearances",
    reason:
      "Often 0 even when AB/BB/HBP are non-zero; OBP uses AB+BB+HBP+SF, not PA.",
  },
  {
    field: "batting.total_bases",
    reason:
      "Often 0 even with hits/extra-base hits; SLG/OPS compute TB from H/2B/3B/HR.",
  },
];

export interface WpblPlayerSeasonInput {
  playerId: string;
  name: string;
  teamId: string;
  position?: string | null;
  headshotUrl?: string | null;
  batting: {
    at_bats: number;
    hits: number;
    doubles: number;
    triples: number;
    home_runs: number;
    rbi: number;
    runs: number;
    walks: number;
    hit_by_pitch: number;
    sacrifice_flies: number;
    stolen_bases: number;
  };
  pitching: {
    outs_pitched: number;
    era: number;
    strikeouts: number;
    wins: number;
    losses: number;
    saves: number;
    hits_allowed: number;
    walks: number;
  };
}

export type WpblLeadersBuild = Omit<WpblLeadersResponse, "updatedAt" | "seasonId">;

const EMPTY_BATTING_BOARDS: WpblLeadersResponse["batting"] = {
  avg: [],
  obp: [],
  slg: [],
  ops: [],
  hr: [],
  rbi: [],
  h: [],
  r: [],
  doubles: [],
  sb: [],
};

const EMPTY_PITCHING_BOARDS: WpblLeadersResponse["pitching"] = {
  era: [],
  whip: [],
  ip: [],
  so: [],
  w: [],
  l: [],
  sv: [],
};

/** Fill missing boards / notes so older Redis blobs stay UI-safe. */
export function normalizeWpblLeadersBlob(
  blob: WpblLeadersResponse,
): WpblLeadersResponse {
  return {
    ...blob,
    qualifiers: {
      battingMinAb: blob.qualifiers?.battingMinAb ?? BATTING_MIN_AB,
      pitchingMinOuts: blob.qualifiers?.pitchingMinOuts ?? PITCHING_MIN_OUTS,
    },
    dataNotes: blob.dataNotes?.length ? blob.dataNotes : WPBL_LEADERS_DATA_NOTES,
    batting: { ...EMPTY_BATTING_BOARDS, ...blob.batting },
    pitching: { ...EMPTY_PITCHING_BOARDS, ...blob.pitching },
  };
}

interface WpblApiBatting {
  at_bats?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  home_runs?: number;
  rbi?: number;
  runs?: number;
  walks?: number;
  hit_by_pitch?: number;
  sacrifice_flies?: number;
  stolen_bases?: number;
}

interface WpblApiPitching {
  outs_pitched?: number;
  era?: number;
  strikeouts?: number;
  wins?: number;
  losses?: number;
  saves?: number;
  hits_allowed?: number;
  walks?: number;
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

function battingRates(player: WpblPlayerSeasonInput) {
  const b = player.batting;
  if (b.at_bats < BATTING_MIN_AB) return null;
  const avg = b.hits / b.at_bats;
  const obp = computeObp({
    hits: b.hits,
    walks: b.walks,
    hbp: b.hit_by_pitch,
    atBats: b.at_bats,
    sf: b.sacrifice_flies,
  });
  const slg = computeSlg({
    hits: b.hits,
    doubles: b.doubles,
    triples: b.triples,
    homeRuns: b.home_runs,
    atBats: b.at_bats,
    // Never trust upstream total_bases (often 0) — omit so SLG derives TB.
  });
  const ops = computeOps(obp, slg);
  return { avg, obp, slg, ops };
}

function parseRateSort(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value.startsWith(".") ? `0${value}` : value);
  return Number.isFinite(n) ? n : null;
}

export function buildWpblLeaders(players: WpblPlayerSeasonInput[]): WpblLeadersBuild {
  return {
    partial: false,
    qualifiers: {
      battingMinAb: BATTING_MIN_AB,
      pitchingMinOuts: PITCHING_MIN_OUTS,
    },
    dataNotes: WPBL_LEADERS_DATA_NOTES,
    batting: {
      avg: buildBoard(players, (player) => {
        const rates = battingRates(player);
        if (!rates) return null;
        return {
          value: formatRate(rates.avg),
          sortValue: rates.avg,
        };
      }),
      obp: buildBoard(players, (player) => {
        const rates = battingRates(player);
        const sortValue = parseRateSort(rates?.obp ?? null);
        if (sortValue == null || rates?.obp == null) return null;
        return { value: rates.obp, sortValue };
      }),
      slg: buildBoard(players, (player) => {
        const rates = battingRates(player);
        const sortValue = parseRateSort(rates?.slg ?? null);
        if (sortValue == null || rates?.slg == null) return null;
        return { value: rates.slg, sortValue };
      }),
      ops: buildBoard(players, (player) => {
        const rates = battingRates(player);
        const sortValue = parseRateSort(rates?.ops ?? null);
        if (sortValue == null || rates?.ops == null) return null;
        return { value: rates.ops, sortValue };
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
      r: buildBoard(players, (player) => ({
        value: String(player.batting.runs),
        sortValue: player.batting.runs,
      })),
      doubles: buildBoard(players, (player) => ({
        value: String(player.batting.doubles),
        sortValue: player.batting.doubles,
      })),
      sb: buildBoard(players, (player) => ({
        value: String(player.batting.stolen_bases),
        sortValue: player.batting.stolen_bases,
      })),
    },
    pitching: {
      era: buildBoard(
        players,
        (player) => {
          if (player.pitching.outs_pitched < PITCHING_MIN_OUTS) return null;
          return {
            value: formatEra(player.pitching.era),
            sortValue: player.pitching.era,
          };
        },
        "asc",
      ),
      whip: buildBoard(
        players,
        (player) => {
          if (player.pitching.outs_pitched < PITCHING_MIN_OUTS) return null;
          const whip = computeWhip(
            player.pitching.hits_allowed,
            player.pitching.walks,
            player.pitching.outs_pitched,
          );
          const sortValue = parseRateSort(whip);
          if (whip == null || sortValue == null) return null;
          return { value: whip, sortValue };
        },
        "asc",
      ),
      ip: buildBoard(players, (player) => {
        if (player.pitching.outs_pitched < PITCHING_MIN_OUTS) return null;
        return {
          value: outsToIp(player.pitching.outs_pitched),
          sortValue: player.pitching.outs_pitched,
        };
      }),
      so: buildBoard(players, (player) => ({
        value: String(player.pitching.strikeouts),
        sortValue: player.pitching.strikeouts,
      })),
      w: buildBoard(players, (player) => ({
        value: String(player.pitching.wins),
        sortValue: player.pitching.wins,
      })),
      l: buildBoard(players, (player) => ({
        value: String(player.pitching.losses),
        sortValue: player.pitching.losses,
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
      doubles: batting.doubles ?? 0,
      triples: batting.triples ?? 0,
      home_runs: batting.home_runs ?? 0,
      rbi: batting.rbi ?? 0,
      runs: batting.runs ?? 0,
      walks: batting.walks ?? 0,
      hit_by_pitch: batting.hit_by_pitch ?? 0,
      sacrifice_flies: batting.sacrifice_flies ?? 0,
      stolen_bases: batting.stolen_bases ?? 0,
    },
    pitching: {
      outs_pitched: pitching.outs_pitched ?? 0,
      era: pitching.era ?? 0,
      strikeouts: pitching.strikeouts ?? 0,
      wins: pitching.wins ?? 0,
      losses: pitching.losses ?? 0,
      saves: pitching.saves ?? 0,
      hits_allowed: pitching.hits_allowed ?? 0,
      walks: pitching.walks ?? 0,
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
