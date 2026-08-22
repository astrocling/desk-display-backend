import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblLiveSituation,
  WpblPitchEvent,
  WpblPlay,
  WpblScheduleGame,
  WpblTrackingEvent,
} from "@/lib/types/wpbl-display";
import { findPlayerLine } from "@/lib/wpbl-player-match";
import { normalizePitchEvent } from "@/lib/wpbl-plays";
import { formatWpblPosition } from "@/lib/wpbl-position";
import { fetchWpblJson } from "./client";
import { mapWpblGames, type WpblGamesPayload } from "./games";
import {
  fetchWpblHeadshotMap,
  resolvePlayerHeadshot,
} from "./headshots";
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
  away_runs?: number;
  home_runs?: number;
}

interface WpblBoxscorePlayer {
  id?: string;
  name: string;
  position?: string;
  spot?: string | number;
  uniform?: string;
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

interface WpblRawPitchEvent {
  sequence?: number;
  code?: string;
  type?: string;
  description?: string;
}

interface WpblRawTrackingActivity {
  activity_id?: string;
  kind?: string;
  sequence?: number;
  occurred_at?: string;
  inning?: number;
  half?: string;
  batter_name?: string;
  pitcher_name?: string;
  batter_id?: string;
  pitcher_id?: string;
  pitch_type?: string;
  hit_type?: string;
  release_speed?: number;
  exit_speed?: number;
  speed_unit?: string;
  spin_rate_rpm?: number;
  launch_angle_deg?: number;
  distance?: number;
  distance_unit?: string;
  strike_zone_decision?: string;
  plate_location_height?: number;
  plate_location_side?: number;
}

interface WpblRawPlay {
  sequence?: number;
  inning?: number;
  half?: string;
  outs?: number;
  batter_name?: string;
  pitcher_name?: string;
  first_base?: string;
  second_base?: string;
  third_base?: string;
  narrative?: string;
  event_type?: string;
  is_hit?: boolean;
  is_scoring_play?: boolean;
  runs_scored?: number;
  pitch_sequence?: string;
  pitch_events?: WpblRawPitchEvent[] | null;
  balls?: number;
  strikes?: number;
  fouls?: number;
}

export interface WpblBoxscorePayload {
  boxscore: {
    game_id?: string;
    game_status?: string;
    status?: WpblBoxscoreStatus;
    teams?: WpblBoxscoreTeam[];
    plays?: WpblRawPlay[] | null;
    tracking_activity?: WpblRawTrackingActivity[] | null;
  };
}

const EMPTY_BOXSCORE: WpblGameDetailResponse["boxscore"] = {
  available: false,
  lineScore: null,
  batting: [],
  pitching: [],
  plays: [],
  tracking: [],
};

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

function parseBattingOrder(spot: string | number | undefined): number | null {
  if (typeof spot === "number" && Number.isFinite(spot) && spot > 0) {
    return Math.floor(spot);
  }
  if (typeof spot === "string" && spot.trim()) {
    const n = Number(spot.trim());
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
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
        battingOrder:
          statKey === "hitting" ? parseBattingOrder(player.spot) : null,
        uniform: player.uniform?.trim() ? player.uniform.trim() : null,
        headshotUrl: null,
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
    runnerFirst: nonemptyName(boxStatus.first_base),
    runnerSecond: nonemptyName(boxStatus.second_base),
    runnerThird: nonemptyName(boxStatus.third_base),
    batterName: nonemptyName(boxStatus.batter_name),
    pitcherName: nonemptyName(boxStatus.pitcher_name),
  };
}

function mapHalf(raw: string | null | undefined): "top" | "bottom" | null {
  const half = raw?.trim().toLowerCase();
  if (half === "top") return "top";
  if (half === "bottom") return "bottom";
  return null;
}

function mapPitchEvents(
  raw: WpblRawPitchEvent[] | null | undefined,
): WpblPitchEvent[] {
  if (!raw?.length) return [];
  const events: WpblPitchEvent[] = [];
  for (const event of raw) {
    const sequence =
      typeof event.sequence === "number" && Number.isFinite(event.sequence)
        ? event.sequence
        : null;
    if (sequence == null) continue;
    events.push(
      normalizePitchEvent({
        sequence,
        code: event.code?.trim() || "",
        type: event.type?.trim() || "",
        description:
          event.description?.trim() || event.type?.trim() || "",
      }),
    );
  }
  return events.sort((a, b) => a.sequence - b.sequence);
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function mapTrackingKind(raw: string | null | undefined): WpblTrackingEvent["kind"] {
  const kind = raw?.trim().toLowerCase();
  if (kind === "pitch") return "pitch";
  if (kind === "hit") return "hit";
  return "other";
}

/** Map official boxscore TrackMan activity; oldest-first by occurred_at. */
export function mapWpblTrackingActivity(
  raw: WpblRawTrackingActivity[] | null | undefined,
): WpblTrackingEvent[] {
  if (!raw?.length) return [];

  const rows: WpblTrackingEvent[] = [];
  for (const item of raw) {
    const activityId = item.activity_id?.trim();
    if (!activityId) continue;
    rows.push({
      activityId,
      kind: mapTrackingKind(item.kind),
      sequence: parseOptionalNumber(item.sequence),
      occurredAt: item.occurred_at?.trim() || null,
      inning:
        typeof item.inning === "number" && item.inning > 0 ? item.inning : null,
      half: mapHalf(item.half),
      batterName: nonemptyName(item.batter_name),
      pitcherName: nonemptyName(item.pitcher_name),
      batterId: item.batter_id?.trim() || null,
      pitcherId: item.pitcher_id?.trim() || null,
      pitchType: item.pitch_type?.trim() || null,
      hitType: item.hit_type?.trim() || null,
      releaseSpeed: parseOptionalNumber(item.release_speed),
      exitSpeed: parseOptionalNumber(item.exit_speed),
      speedUnit: item.speed_unit?.trim() || null,
      spinRateRpm: parseOptionalNumber(item.spin_rate_rpm),
      launchAngleDeg: parseOptionalNumber(item.launch_angle_deg),
      distance: parseOptionalNumber(item.distance),
      distanceUnit: item.distance_unit?.trim() || null,
      strikeZoneDecision: item.strike_zone_decision?.trim() || null,
      plateLocationHeight: parseOptionalNumber(item.plate_location_height),
      plateLocationSide: parseOptionalNumber(item.plate_location_side),
    });
  }

  return rows.sort((a, b) => {
    const ta = Date.parse(a.occurredAt ?? "") || 0;
    const tb = Date.parse(b.occurredAt ?? "") || 0;
    if (ta !== tb) return ta - tb;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
}

/** Map a single live tracking_activity_updated payload. */
export function mapWpblTrackingEvent(
  raw: unknown,
): WpblTrackingEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const mapped = mapWpblTrackingActivity([raw as WpblRawTrackingActivity]);
  return mapped[0] ?? null;
}

/** Map official boxscore plays; oldest-first by sequence. */
export function mapWpblPlays(
  rawPlays: WpblRawPlay[] | null | undefined,
): WpblPlay[] {
  if (!rawPlays?.length) return [];

  const plays: WpblPlay[] = [];
  for (const play of rawPlays) {
    const narrative = play.narrative?.trim() ?? "";
    const sequence =
      typeof play.sequence === "number" && Number.isFinite(play.sequence)
        ? play.sequence
        : null;
    const inning =
      typeof play.inning === "number" && play.inning > 0 ? play.inning : null;
    if (sequence == null || inning == null || !narrative) continue;

    const runsScored =
      typeof play.runs_scored === "number" && Number.isFinite(play.runs_scored)
        ? Math.max(0, play.runs_scored)
        : 0;

    plays.push({
      sequence,
      inning,
      half: mapHalf(play.half),
      outs: parseCount(play.outs),
      batterName: nonemptyName(play.batter_name),
      pitcherName: nonemptyName(play.pitcher_name),
      runnerFirst: nonemptyName(play.first_base),
      runnerSecond: nonemptyName(play.second_base),
      runnerThird: nonemptyName(play.third_base),
      narrative,
      eventType: play.event_type?.trim() || "unknown",
      isHit: Boolean(play.is_hit),
      isScoringPlay: Boolean(play.is_scoring_play) || runsScored > 0,
      runsScored,
      pitchSequence: nonemptyName(play.pitch_sequence),
      pitchEvents: mapPitchEvents(play.pitch_events),
      finalBalls: parseCount(play.balls),
      finalStrikes: parseCount(play.strikes),
      finalFouls: parseCount(play.fouls),
    });
  }

  return plays.sort((a, b) => a.sequence - b.sequence);
}

export function mapWpblBoxscore(
  raw: WpblBoxscorePayload,
  _gameMeta: WpblScheduleGame,
): WpblGameDetailResponse["boxscore"] {
  const teams = raw.boxscore?.teams ?? [];
  const plays = mapWpblPlays(raw.boxscore?.plays);
  const tracking = mapWpblTrackingActivity(raw.boxscore?.tracking_activity);
  const hasContent = teams.some(
    (team) =>
      (team.line?.length ?? 0) > 0 || (team.players?.length ?? 0) > 0,
  );
  if (!hasContent) {
    return { ...EMPTY_BOXSCORE, plays, tracking };
  }

  return {
    available: true,
    lineScore: mapLineScore(teams),
    batting: mapPlayerLines(teams, "hitting", BATTING_STAT_KEYS),
    pitching: mapPlayerLines(teams, "pitching", PITCHING_STAT_KEYS),
    plays,
    tracking,
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

/** Attach official headshots onto batting/pitching lines (mutates in place). */
export async function enrichBoxscoreHeadshots(
  boxscore: WpblGameDetailResponse["boxscore"],
): Promise<void> {
  if (!boxscore.available) return;
  const lines = [...boxscore.batting, ...boxscore.pitching];
  if (!lines.length) return;

  let headshotMap: Map<string, string>;
  try {
    headshotMap = await fetchWpblHeadshotMap();
  } catch {
    return;
  }
  if (headshotMap.size === 0) return;

  for (const line of lines) {
    line.headshotUrl = resolvePlayerHeadshot({
      playerId: line.playerId ?? "",
      name: line.name,
      headshotMap,
    });
  }
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
    : { ...EMPTY_BOXSCORE };

  const status = mapWpblStatus(boxRaw?.boxscore?.game_status ?? gameRaw.status);
  const boxStatus = boxRaw?.boxscore?.status;
  const situation = mapWpblLiveSituation(status, boxStatus);
  const seasonId = gameRaw.season_id?.trim() || FALLBACK_SEASON_ID;

  await Promise.all([
    situation && boxscore.available
      ? enrichLiveKeyPlayerSeasonRates(boxscore, situation, seasonId)
      : Promise.resolve(),
    enrichBoxscoreHeadshots(boxscore),
  ]);

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
