import type {
  WpblPlayerBattingSeason,
  WpblPlayerDetailResponse,
  WpblPlayerFieldingSeason,
  WpblPlayerGameLogEntry,
  WpblPlayerPitchingSeason,
} from "@/lib/types/wpbl-display";
import { formatWpblPosition } from "@/lib/wpbl-position";
import { fetchWpblJson } from "./client";
import {
  fetchWpblHeadshotMap,
  resolvePlayerHeadshot,
} from "./headshots";
import {
  computeAvg,
  computeObp,
  computeOps,
  computeSlg,
  computeWhip,
  formatEra,
  formatFieldingPct,
  ipToOuts,
  outsToIp,
} from "./player-rates";
import { FALLBACK_SEASON_ID, teamFromId } from "./teams";

export interface WpblApiPlayerProfile {
  player_id: string;
  team_id?: string;
  profile_url?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  uniform?: string;
  headshot_url?: string;
  dob?: string;
  hometown?: string;
  is_active?: boolean;
  player_status?: string;
  presto_data?: {
    data?: {
      bats?: string;
      throws?: string;
      hometown?: string;
      born?: string;
    } | null;
  } | null;
}

export interface WpblApiPlayerSeasonStats {
  season_id?: string;
  player_id: string;
  player_name?: string;
  profile_url?: string;
  source_through?: string;
  batting?: Record<string, number | string | null>;
  pitching?: Record<string, number | string | null>;
  fielding?: Record<string, number | string | null>;
}

export interface WpblApiPlayerGames {
  season_id?: string;
  player_id: string;
  profile_url?: string;
  count?: number;
  games?: WpblApiPlayerGameRow[];
}

export interface WpblApiPlayerGameRow {
  game_id: string;
  scheduled_start?: string | null;
  side?: string;
  result?: string | null;
  is_final?: boolean;
  team_runs?: number | null;
  opponent_runs?: number | null;
  opponent_team_id?: string;
  opponent_team_name?: string;
  batting?: WpblApiGameStatBlock | null;
  pitching?: WpblApiGameStatBlock | null;
  fielding?: WpblApiGameStatBlock | null;
}

type WpblApiGameStatBlock = Record<string, unknown> & {
  source_stats?: Record<string, string | number | null>;
};

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function pickStat(
  block: WpblApiGameStatBlock | null | undefined,
  keys: string[],
): string | number | null {
  if (!block) return null;
  const source = block.source_stats ?? {};
  for (const key of keys) {
    const fromSource = source[key];
    if (fromSource != null && String(fromSource).trim() !== "") {
      return fromSource;
    }
    const fromTop = block[key];
    if (fromTop != null && typeof fromTop !== "object") {
      const s = String(fromTop).trim();
      if (s !== "" && s !== "null") return fromTop as string | number;
    }
  }
  return null;
}

export function mapBattingSeason(
  raw: Record<string, number | string | null> | undefined,
): WpblPlayerBattingSeason | null {
  if (!raw) return null;
  const ab = num(raw.at_bats);
  const h = num(raw.hits);
  const g = num(raw.games_played);
  if (ab <= 0 && h <= 0 && g <= 0) return null;

  const doubles = num(raw.doubles);
  const triples = num(raw.triples);
  const hr = num(raw.home_runs);
  const bb = num(raw.walks);
  const hbp = num(raw.hit_by_pitch);
  const sf = num(raw.sacrifice_flies);
  const avg = computeAvg(h, ab);
  const obp = computeObp({ hits: h, walks: bb, hbp, atBats: ab, sf });
  const slg = computeSlg({
    hits: h,
    doubles,
    triples,
    homeRuns: hr,
    atBats: ab,
    totalBases: num(raw.total_bases),
  });

  return {
    g,
    ab,
    r: num(raw.runs),
    h,
    doubles,
    triples,
    hr,
    rbi: num(raw.rbi),
    bb,
    so: num(raw.strikeouts),
    hbp,
    sf,
    sb: num(raw.stolen_bases),
    cs: num(raw.caught_stealing),
    avg,
    obp,
    slg,
    ops: computeOps(obp, slg),
  };
}

export function mapPitchingSeason(
  raw: Record<string, number | string | null> | undefined,
): WpblPlayerPitchingSeason | null {
  if (!raw) return null;
  const outs = num(raw.outs_pitched);
  const g = num(raw.games_played);
  if (outs <= 0 && g <= 0) return null;

  const ipStr = str(raw.innings_pitched) ?? outsToIp(outs);
  const outsResolved = outs > 0 ? outs : ipToOuts(ipStr);
  const h = num(raw.hits_allowed);
  const bb = num(raw.walks);
  const eraRaw = num(raw.era, Number.NaN);

  return {
    g,
    gs: num(raw.games_started),
    w: num(raw.wins),
    l: num(raw.losses),
    sv: num(raw.saves),
    ip: ipStr,
    h,
    r: num(raw.runs_allowed),
    er: num(raw.earned_runs),
    bb,
    so: num(raw.strikeouts),
    hr: num(raw.home_runs_allowed),
    era: Number.isFinite(eraRaw) ? formatEra(eraRaw) : null,
    whip: computeWhip(h, bb, outsResolved),
  };
}

export function mapFieldingSeason(
  raw: Record<string, number | string | null> | undefined,
): WpblPlayerFieldingSeason | null {
  if (!raw) return null;
  const g = num(raw.games_played);
  const tc = num(raw.total_chances);
  const po = num(raw.putouts);
  const a = num(raw.assists);
  const e = num(raw.errors);
  if (g <= 0 && tc <= 0 && po + a + e <= 0) return null;

  const fpctRaw = num(raw.fielding_percentage, Number.NaN);
  return {
    g,
    po,
    a,
    e,
    tc: tc > 0 ? tc : po + a + e,
    dp: num(raw.double_plays),
    fpct: Number.isFinite(fpctRaw) ? formatFieldingPct(fpctRaw) : null,
  };
}

function mapGameBatting(
  block: WpblApiGameStatBlock | null | undefined,
): Record<string, string | number | null> | null {
  if (!block) return null;
  const ab = pickStat(block, ["ab", "at_bats"]);
  const h = pickStat(block, ["h", "hits"]);
  if (ab == null && h == null) return null;
  return {
    ab: ab ?? 0,
    r: pickStat(block, ["r", "runs"]) ?? 0,
    h: h ?? 0,
    doubles: pickStat(block, ["2b", "doubles"]),
    triples: pickStat(block, ["3b", "triples"]),
    hr: pickStat(block, ["hr", "home_runs"]) ?? 0,
    rbi: pickStat(block, ["rbi"]) ?? 0,
    bb: pickStat(block, ["bb", "walks"]) ?? 0,
    so: pickStat(block, ["so", "strikeouts", "kl"]) ?? 0,
    sb: pickStat(block, ["sb", "stolen_bases"]),
    obp: pickStat(block, ["obp"]),
    slg: pickStat(block, ["slg"]),
    ops: pickStat(block, ["ops"]),
  };
}

function mapGamePitching(
  block: WpblApiGameStatBlock | null | undefined,
): Record<string, string | number | null> | null {
  if (!block) return null;
  const ip = pickStat(block, ["ip", "innings_pitched"]);
  const so = pickStat(block, ["so", "strikeouts"]);
  if (ip == null && so == null && block.outs_pitched == null) return null;
  return {
    ip: ip ?? outsToIp(num(block.outs_pitched)),
    h: pickStat(block, ["h", "hits_allowed"]) ?? 0,
    r: pickStat(block, ["r", "runs_allowed"]) ?? 0,
    er: pickStat(block, ["er", "earned_runs"]) ?? 0,
    bb: pickStat(block, ["bb", "walks"]) ?? 0,
    so: so ?? 0,
    hr: pickStat(block, ["hr", "home_runs_allowed"]),
    era: pickStat(block, ["era"]),
    whip: pickStat(block, ["whip"]),
    decision: pickStat(block, ["win", "decision"]),
  };
}

function mapGameFielding(
  block: WpblApiGameStatBlock | null | undefined,
): Record<string, string | number | null> | null {
  if (!block) return null;
  const po = pickStat(block, ["po", "putouts"]);
  const a = pickStat(block, ["a", "assists"]);
  const e = pickStat(block, ["e", "errors"]);
  if (po == null && a == null && e == null) return null;
  return {
    po: po ?? 0,
    a: a ?? 0,
    e: e ?? 0,
  };
}

export function mapPlayerGameLog(
  games: WpblApiPlayerGameRow[] | undefined,
): WpblPlayerGameLogEntry[] {
  if (!games?.length) return [];

  const mapped = games.map((row): WpblPlayerGameLogEntry => {
    const opponent = teamFromId(row.opponent_team_id ?? "");
    const resultRaw = str(row.result)?.toUpperCase() ?? null;
    const result =
      resultRaw === "W" || resultRaw === "L" || resultRaw === "T"
        ? resultRaw
        : null;

    return {
      gameId: row.game_id,
      startIso: str(row.scheduled_start),
      side: row.side === "home" ? "home" : "away",
      result,
      teamRuns: row.team_runs ?? null,
      opponentRuns: row.opponent_runs ?? null,
      opponentAbbr: opponent?.abbr ?? "??",
      opponentName:
        opponent?.name ??
        str(row.opponent_team_name)?.replace(
          /^(Los Angeles|New York|San Francisco|Boston)\s+/i,
          "",
        ) ??
        "—",
      isFinal: Boolean(row.is_final),
      batting: mapGameBatting(row.batting),
      pitching: mapGamePitching(row.pitching),
      fielding: mapGameFielding(row.fielding),
    };
  });

  mapped.sort((a, b) => {
    const aMs = a.startIso ? Date.parse(a.startIso) : 0;
    const bMs = b.startIso ? Date.parse(b.startIso) : 0;
    return bMs - aMs;
  });

  return mapped;
}

export function mapPlayerDetail(options: {
  profile: WpblApiPlayerProfile;
  stats: WpblApiPlayerSeasonStats | null;
  games: WpblApiPlayerGames | null;
  headshotMap: Map<string, string>;
  seasonId: string;
  partial: boolean;
}): Omit<WpblPlayerDetailResponse, "updatedAt"> {
  const { profile, stats, games, headshotMap, seasonId, partial } = options;
  const team = teamFromId(profile.team_id ?? "");
  const firstName = profile.first_name?.trim() ?? "";
  const lastName = profile.last_name?.trim() ?? "";
  const name =
    `${firstName} ${lastName}`.trim() ||
    stats?.player_name?.trim() ||
    profile.player_id;

  const presto = profile.presto_data?.data ?? {};
  const hometown =
    str(presto.hometown) ||
    str(profile.hometown) ||
    null;

  const headshotUrl = resolvePlayerHeadshot({
    playerId: profile.player_id,
    name,
    rosterHeadshotUrl: profile.headshot_url,
    headshotMap,
  });

  return {
    seasonId: stats?.season_id ?? games?.season_id ?? seasonId,
    partial,
    player: {
      id: profile.player_id,
      name,
      firstName,
      lastName,
      teamId: profile.team_id ?? "",
      teamAbbr: team?.abbr ?? "??",
      teamName: team?.name ?? "—",
      position: formatWpblPosition(profile.position),
      uniform: str(profile.uniform),
      bats: str(presto.bats),
      throws: str(presto.throws),
      hometown,
      birthdate: str(profile.dob) || str(presto.born),
      status: str(profile.player_status),
      headshotUrl,
      profileUrl:
        str(profile.profile_url) ||
        str(stats?.profile_url) ||
        str(games?.profile_url),
    },
    season: {
      sourceThrough: str(stats?.source_through),
      batting: mapBattingSeason(stats?.batting),
      pitching: mapPitchingSeason(stats?.pitching),
      fielding: mapFieldingSeason(stats?.fielding),
    },
    gameLog: mapPlayerGameLog(games?.games),
  };
}

export async function fetchWpblPlayerDetail(
  id: string,
  seasonId: string = FALLBACK_SEASON_ID,
): Promise<WpblPlayerDetailResponse> {
  const encoded = encodeURIComponent(id);

  let profile: WpblApiPlayerProfile;
  try {
    profile = await fetchWpblJson<WpblApiPlayerProfile>(
      `/v1/players/${encoded}`,
      { ttlMs: 0 },
    );
  } catch (error) {
    throw error;
  }

  const [statsResult, gamesResult, headshotMap] = await Promise.all([
    fetchWpblJson<WpblApiPlayerSeasonStats>(
      `/v1/players/${encoded}/stats?season_id=${encodeURIComponent(seasonId)}`,
      { ttlMs: 0 },
    ).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    fetchWpblJson<WpblApiPlayerGames>(
      `/v1/players/${encoded}/games?season_id=${encodeURIComponent(seasonId)}`,
      { ttlMs: 0 },
    ).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    fetchWpblHeadshotMap(),
  ]);

  const partial = !statsResult.ok || !gamesResult.ok;

  const mapped = mapPlayerDetail({
    profile,
    stats: statsResult.ok ? statsResult.value : null,
    games: gamesResult.ok ? gamesResult.value : null,
    headshotMap,
    seasonId,
    partial,
  });

  return {
    ...mapped,
    updatedAt: new Date().toISOString(),
  };
}
