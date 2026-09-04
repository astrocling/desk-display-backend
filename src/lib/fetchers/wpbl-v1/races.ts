import type {
  WpblLeaderEntry,
  WpblLeadersResponse,
  WpblPlayerDetailResponse,
  WpblPlayerGameLogEntry,
  WpblRacePoint,
  WpblRaceSeries,
  WpblRacesResponse,
} from "@/lib/types/wpbl-display";

export type RaceStatKey = "hr" | "rbi" | "sb" | "so";

const RACE_DEFS: {
  id: RaceStatKey;
  label: string;
  side: "batting" | "pitching";
  getBoard: (leaders: WpblLeadersResponse) => WpblLeaderEntry[];
}[] = [
  {
    id: "hr",
    label: "HR",
    side: "batting",
    getBoard: (l) => l.batting.hr ?? [],
  },
  {
    id: "rbi",
    label: "RBI",
    side: "batting",
    getBoard: (l) => l.batting.rbi ?? [],
  },
  {
    id: "sb",
    label: "SB",
    side: "batting",
    getBoard: (l) => l.batting.sb ?? [],
  },
  {
    id: "so",
    label: "SO",
    side: "pitching",
    getBoard: (l) => l.pitching.so ?? [],
  },
];

function numFromLog(
  block: Record<string, string | number | null> | null,
  key: string,
): number {
  if (!block) return 0;
  const raw = block[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function gameStat(entry: WpblPlayerGameLogEntry, raceId: RaceStatKey): number {
  if (raceId === "so") {
    return numFromLog(entry.pitching, "so");
  }
  return numFromLog(entry.batting, raceId);
}

/**
 * Build ascending cumulative points from a player's game log (oldest → newest).
 * Games without a date are skipped. Finals and non-finals with dates both count
 * when the relevant counting stat is present.
 */
export function cumulativeRacePoints(
  gameLog: WpblPlayerGameLogEntry[],
  raceId: RaceStatKey,
): WpblRacePoint[] {
  const dated = gameLog
    .filter((g) => g.startIso && Number.isFinite(Date.parse(g.startIso)))
    .slice()
    .sort(
      (a, b) => Date.parse(a.startIso!) - Date.parse(b.startIso!),
    );

  let total = 0;
  const points: WpblRacePoint[] = [];
  for (const game of dated) {
    total += gameStat(game, raceId);
    points.push({
      date: game.startIso!.slice(0, 10),
      gameId: game.gameId,
      value: total,
    });
  }
  return points;
}

export function buildRaceSeriesForPlayer(
  player: Pick<
    WpblPlayerDetailResponse["player"],
    "id" | "name" | "teamAbbr" | "headshotUrl"
  >,
  gameLog: WpblPlayerGameLogEntry[],
  raceId: RaceStatKey,
): WpblRaceSeries | null {
  const points = cumulativeRacePoints(gameLog, raceId);
  if (points.length === 0) return null;
  return {
    playerId: player.id,
    name: player.name,
    teamAbbr: player.teamAbbr,
    headshotUrl: player.headshotUrl,
    points,
    total: points[points.length - 1]!.value,
  };
}

export function buildWpblRacesBlob(options: {
  leaders: WpblLeadersResponse;
  playersById: Map<string, WpblPlayerDetailResponse>;
  perRace?: number;
}): Omit<WpblRacesResponse, "updatedAt"> {
  const { leaders, playersById, perRace = 6 } = options;
  const races: WpblRacesResponse["races"] = {
    hr: [],
    rbi: [],
    sb: [],
    so: [],
  };
  let missingPlayers = 0;

  for (const def of RACE_DEFS) {
    const board = def.getBoard(leaders).slice(0, perRace);
    const series: WpblRaceSeries[] = [];
    for (const entry of board) {
      const detail = playersById.get(entry.playerId);
      if (!detail) {
        missingPlayers += 1;
        continue;
      }
      const built = buildRaceSeriesForPlayer(
        {
          id: detail.player.id,
          name: detail.player.name,
          teamAbbr: detail.player.teamAbbr || entry.teamAbbr,
          headshotUrl: detail.player.headshotUrl ?? entry.headshotUrl,
        },
        detail.gameLog,
        def.id,
      );
      if (built) series.push(built);
    }
    series.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    races[def.id] = series;
  }

  return {
    seasonId: leaders.seasonId,
    partial: leaders.partial || missingPlayers > 0,
    races,
  };
}

export function racePlayerIdsToLoad(
  leaders: WpblLeadersResponse,
  perRace = 6,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const def of RACE_DEFS) {
    for (const entry of def.getBoard(leaders).slice(0, perRace)) {
      if (!entry.playerId || seen.has(entry.playerId)) continue;
      seen.add(entry.playerId);
      ids.push(entry.playerId);
    }
  }
  return ids;
}
