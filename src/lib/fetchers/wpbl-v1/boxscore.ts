import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblScheduleGame,
} from "@/lib/types/wpbl-display";
import { fetchWpblJson } from "./client";
import { mapWpblGames, type WpblGamesPayload } from "./games";
import { mapWpblStatus } from "./status";
import { teamFromId } from "./teams";

const BATTING_STAT_KEYS = ["ab", "r", "h", "rbi", "bb", "so", "avg", "obp", "slg"] as const;
const PITCHING_STAT_KEYS = ["ip", "h", "r", "er", "bb", "so", "era"] as const;

interface WpblBoxscoreStatus {
  inning?: number;
  half?: string;
}

interface WpblBoxscorePlayer {
  name: string;
  position?: string;
  hitting?: Record<string, string>;
  pitching?: Record<string, string>;
}

interface WpblBoxscoreTeam {
  side: string;
  id: string;
  name: string;
  line: Array<{ inning: number; runs: number }>;
  totals: {
    runs: number;
    hits: number;
    errors: number;
    left_on_base: number;
  };
  players: WpblBoxscorePlayer[];
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
    for (const player of team.players) {
      const rawStats = player[statKey];
      if (!rawStats) continue;
      lines.push({
        side,
        name: player.name,
        position: player.position?.trim() ? player.position : null,
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
    return {
      side: (team.side === "home" ? "home" : "away") as "away" | "home",
      abbr: info?.abbr ?? "??",
      name: info?.name ?? team.name,
      innings: team.line.map(({ inning, runs }) => ({ inning, runs })),
      runs: team.totals.runs,
      hits: team.totals.hits,
      errors: team.totals.errors,
      lob: team.totals.left_on_base,
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

export function mapWpblBoxscore(
  raw: WpblBoxscorePayload,
  _gameMeta: WpblScheduleGame,
): WpblGameDetailResponse["boxscore"] {
  const teams = raw.boxscore?.teams ?? [];
  if (teams.length === 0) {
    return { available: false, lineScore: null, batting: [], pitching: [] };
  }

  return {
    available: true,
    lineScore: mapLineScore(teams),
    batting: mapPlayerLines(teams, "hitting", BATTING_STAT_KEYS),
    pitching: mapPlayerLines(teams, "pitching", PITCHING_STAT_KEYS),
  };
}

export async function fetchWpblGameDetail(id: string): Promise<WpblGameDetailResponse> {
  const [gameRaw, boxRaw] = await Promise.all([
    fetchWpblJson<WpblGamesPayload["games"][number]>(`/v1/games/${id}`),
    fetchWpblJson<WpblBoxscorePayload>(`/v1/games/${id}/boxscore`).catch(
      (): WpblBoxscorePayload | null => null,
    ),
  ]);

  const [gameMeta] = mapWpblGames({ games: [gameRaw] });
  if (!gameMeta) {
    throw new Error(`Unknown WPBL game ${id}`);
  }

  const boxscore = boxRaw
    ? mapWpblBoxscore(boxRaw, gameMeta)
    : { available: false, lineScore: null, batting: [], pitching: [] };

  const status = mapWpblStatus(boxRaw?.boxscore?.game_status ?? gameRaw.status);

  return {
    updatedAt: new Date().toISOString(),
    game: {
      ...gameMeta,
      status,
      inning: formatInningLabel(status, boxRaw?.boxscore?.status),
    },
    boxscore,
  };
}
