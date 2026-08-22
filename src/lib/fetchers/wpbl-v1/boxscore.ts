import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblLiveSituation,
  WpblScheduleGame,
} from "@/lib/types/wpbl-display";
import { findPlayerLine } from "@/lib/wpbl-player-match";
import { formatWpblPosition } from "@/lib/wpbl-position";
import { fetchWpblJson } from "./client";
import { mapWpblGames, type WpblGamesPayload } from "./games";
import { mapWpblStatus } from "./status";
import { FALLBACK_SEASON_ID, teamFromId } from "./teams";

const BATTING_STAT_KEYS = ["ab", "r", "h", "rbi", "bb", "so", "avg", "obp", "slg"] as const;
const PITCHING_STAT_KEYS = ["ip", "h", "r", "er", "bb", "so", "era"] as const;

export interface WpblBoxscoreStatus {
  inning?: number;
  half?: string;
  outs?: number;
  balls?: number;
  strikes?: number;
  batter_name?: string;
  pitcher_name?: string;
  first_base?: string;
  second_base?: string;
  third_base?: string;
  bases_occupied?: Array<number | string> | null;
}

interface WpblBoxscorePlayer {
  id?: string;
  name: string;
  position?: string;
  hitting?: Record<string, string>;
  pitching?: Record<string, string>;
}

interface WpblPlayerSeasonStats {
  player_id: string;
  batting?: {
    at_bats?: number;
    hits?: number;
  };
  pitching?: {
    era?: number;
  };
}

interface WpblBoxscoreTeam {
  side: string;
  id: string;
  name: string;
  line?: Array<{ inning: number; runs: number }> | null;
  totals?: {
    runs: number | null;
    hits: number | null;
    errors: number | null;
    left_on_base: number | null;
  } | null;
  players?: WpblBoxscorePlayer[] | null;
}

export interface WpblBoxscorePayload {
  boxscore: {
    game_id?: string;
    game_status?: string;
    status?: WpblBoxscoreStatus;
    teams?: WpblBoxscoreTeam[];
  };
}

function mapStatGroup(
  raw: Record<string, string> | undefined,
  keys: readonly string[],
): Record<string, string | number | null> {
  if (!raw) return {};
  const stats: Record<string, string | number | null> = {};
  for (const key of keys) {
    const value = raw[key];
    if (value == null || value === "") continue;
    stats[key] = value;
  }
  return stats;
}

function mapPlayerLines(
  teams: WpblBoxscoreTeam[],
  statKey: "hitting" | "pitching",
  statKeys: readonly string[],
): WpblBoxPlayerLine[] {
  const lines: WpblBoxPlayerLine[] = [];
  for (const team of teams) {
    const side = team.side === "home" ? "home" : "away";
    for (const player of team.players ?? []) {
      const rawStats = player[statKey];
      if (!rawStats) continue;
      lines.push({
        side,
        name: player.name,
        playerId: player.id?.trim() ? player.id.trim() : null,
        position: formatWpblPosition(player.position),
        stats: mapStatGroup(rawStats, statKeys),
      });
    }
  }
  return lines;
}

function mapLineScore(
  teams: WpblBoxscoreTeam[],
): NonNullable<WpblGameDetailResponse["boxscore"]["lineScore"]> {
  const mappedTeams = teams.map((team) => {
    const info = teamFromId(team.id);
    const line = team.line ?? [];
    const totals = team.totals ?? {
      runs: null,
      hits: null,
      errors: null,
      left_on_base: null,
    };
    return {
      side: (team.side === "home" ? "home" : "away") as "away" | "home",
      abbr: info?.abbr ?? "??",
      name: info?.name ?? team.name,
      innings: line.map(({ inning, runs }) => ({ inning, runs })),
      runs: totals.runs ?? null,
      hits: totals.hits ?? null,
      errors: totals.errors ?? null,
      lob: totals.left_on_base ?? null,
    };
  });
  const maxInning = Math.max(
    0,
    ...mappedTeams.flatMap((team) => team.innings.map((inning) => inning.inning)),
  );
  return { maxInning, teams: mappedTeams };
}

export function formatInningLabel(
  gameStatus: WpblGameStatus,
  boxStatus: WpblBoxscoreStatus | null | undefined,
): string | null {
  if (gameStatus !== "live" || !boxStatus) return null;
  const inning = boxStatus.inning;
  if (inning == null || inning <= 0) return null;
  const half = boxStatus.half?.trim().toLowerCase();
  if (half === "top") return `Top ${inning}`;
  if (half === "bottom") return `Bot ${inning}`;
  return null;
}

function nonemptyName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function baseOccupied(
  named: string | null | undefined,
  basesOccupied: Array<number | string> | null | undefined,
  base: 1 | 2 | 3,
): boolean {
  if (nonemptyName(named)) return true;
  if (!basesOccupied?.length) return false;
  return basesOccupied.some((entry) => Number(entry) === base || entry === String(base));
}

function parseCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Live situation from boxscore status; null when not live or status missing. */
export function mapWpblLiveSituation(
  gameStatus: WpblGameStatus,
  boxStatus: WpblBoxscoreStatus | null | undefined,
): WpblLiveSituation | null {
  if (gameStatus !== "live" || !boxStatus) return null;

  const halfRaw = boxStatus.half?.trim().toLowerCase();
  const half =
    halfRaw === "top" ? "top" : halfRaw === "bottom" ? "bottom" : null;
  const inningNumber =
    typeof boxStatus.inning === "number" && boxStatus.inning > 0
      ? boxStatus.inning
      : null;

  return {
    inningNumber,
    half,
    balls: parseCount(boxStatus.balls),
    strikes: parseCount(boxStatus.strikes),
    outs: parseCount(boxStatus.outs),
    onFirst: baseOccupied(boxStatus.first_base, boxStatus.bases_occupied, 1),
    onSecond: baseOccupied(boxStatus.second_base, boxStatus.bases_occupied, 2),
    onThird: baseOccupied(boxStatus.third_base, boxStatus.bases_occupied, 3),
    batterName: nonemptyName(boxStatus.batter_name),
    pitcherName: nonemptyName(boxStatus.pitcher_name),
  };
}

export function mapWpblBoxscore(
  raw: WpblBoxscorePayload,
  _gameMeta: WpblScheduleGame,
): WpblGameDetailResponse["boxscore"] {
  const teams = raw.boxscore?.teams ?? [];
  const hasContent = teams.some(
    (team) =>
      (team.line?.length ?? 0) > 0 || (team.players?.length ?? 0) > 0,
  );
  if (!hasContent) {
    return { available: false, lineScore: null, batting: [], pitching: [] };
  }

  return {
    available: true,
    lineScore: mapLineScore(teams),
    batting: mapPlayerLines(teams, "hitting", BATTING_STAT_KEYS),
    pitching: mapPlayerLines(teams, "pitching", PITCHING_STAT_KEYS),
  };
}

/** Format season AVG the same way leaders boards do (trim leading zero). */
export function formatSeasonAvg(hits: number, atBats: number): string | null {
  if (!(atBats > 0) || !Number.isFinite(hits) || !Number.isFinite(atBats)) {
    return null;
  }
  return (hits / atBats).toFixed(3).replace(/^0/, "");
}

export function formatSeasonEra(era: number): string | null {
  if (!Number.isFinite(era)) return null;
  return era.toFixed(2);
}

/**
 * WPBL boxscore hitting rates (obp/slg/ops) are game-level, not season AVG.
 * Patch the live batter/pitcher lines with season AVG / ERA from player stats.
 */
export async function enrichLiveKeyPlayerSeasonRates(
  boxscore: WpblGameDetailResponse["boxscore"],
  situation: WpblLiveSituation | null,
  seasonId: string,
): Promise<void> {
  if (!situation) return;

  const batterLine = findPlayerLine(boxscore.batting, situation.batterName);
  const pitcherLine = findPlayerLine(boxscore.pitching, situation.pitcherName);

  const jobs: Array<{
    line: WpblBoxPlayerLine;
    role: "batter" | "pitcher";
  }> = [];
  if (batterLine?.playerId) {
    jobs.push({ line: batterLine, role: "batter" });
  }
  if (pitcherLine?.playerId) {
    jobs.push({ line: pitcherLine, role: "pitcher" });
  }
  if (jobs.length === 0) return;

  await Promise.all(
    jobs.map(async ({ line, role }) => {
      try {
        const stats = await fetchWpblJson<WpblPlayerSeasonStats>(
          `/v1/players/${encodeURIComponent(line.playerId!)}/stats?season_id=${encodeURIComponent(seasonId)}`,
        );
        if (role === "batter") {
          const avg = formatSeasonAvg(
            stats.batting?.hits ?? 0,
            stats.batting?.at_bats ?? 0,
          );
          if (avg) line.stats.avg = avg;
        } else {
          const era = formatSeasonEra(stats.pitching?.era ?? Number.NaN);
          if (era) line.stats.era = era;
        }
      } catch {
        // Leave game line without season rate if the stats call fails.
      }
    }),
  );
}

export async function fetchWpblGameDetail(
  id: string,
): Promise<WpblGameDetailResponse> {
  const [gameResult, boxResult] = await Promise.allSettled([
    fetchWpblJson<WpblGamesPayload["games"][number]>(`/v1/games/${encodeURIComponent(id)}`),
    fetchWpblJson<WpblBoxscorePayload>(
      `/v1/games/${encodeURIComponent(id)}/boxscore`,
    ),
  ]);

  let gameRaw =
    gameResult.status === "fulfilled" ? gameResult.value : null;
  const boxRaw =
    boxResult.status === "fulfilled" ? boxResult.value : null;

  // If the single-game endpoint fails (429/404), recover meta from the full list.
  if (!gameRaw) {
    try {
      const list = await fetchWpblJson<WpblGamesPayload>("/v1/games");
      gameRaw = list.games.find((game) => game.game_id === id) ?? null;
    } catch {
      gameRaw = null;
    }
  }

  if (!gameRaw) {
    const reason =
      gameResult.status === "rejected" && gameResult.reason instanceof Error
        ? gameResult.reason.message
        : `Unknown WPBL game ${id}`;
    throw new Error(reason);
  }

  const [gameMeta] = mapWpblGames({ games: [gameRaw] });
  if (!gameMeta) {
    throw new Error(`Unmapped WPBL game ${id}`);
  }

  const boxscore = boxRaw
    ? mapWpblBoxscore(boxRaw, gameMeta)
    : { available: false, lineScore: null, batting: [], pitching: [] };

  const status = mapWpblStatus(boxRaw?.boxscore?.game_status ?? gameRaw.status);
  const boxStatus = boxRaw?.boxscore?.status;
  const situation = mapWpblLiveSituation(status, boxStatus);
  const seasonId = gameRaw.season_id?.trim() || FALLBACK_SEASON_ID;

  if (situation && boxscore.available) {
    await enrichLiveKeyPlayerSeasonRates(boxscore, situation, seasonId);
  }

  return {
    updatedAt: new Date().toISOString(),
    game: {
      ...gameMeta,
      status,
      inning: formatInningLabel(status, boxStatus),
      situation,
    },
    boxscore,
  };
}
