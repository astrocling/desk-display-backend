import type {
  WpblLeaderEntry,
  WpblLeadersResponse,
  WpblScheduleGame,
} from "@/lib/types/wpbl-display";

export type AwardCandidate = {
  playerId: string;
  name: string;
  teamAbbr: string;
  headshotUrl: string | null;
  position: string | null;
  score: number;
  scoreLabel: string;
  highlights: string[];
};

function boardMap(
  entries: WpblLeaderEntry[] | undefined,
): Map<string, WpblLeaderEntry> {
  const map = new Map<string, WpblLeaderEntry>();
  for (const e of entries ?? []) {
    if (!map.has(e.playerId)) map.set(e.playerId, e);
  }
  return map;
}

function pushCandidates(
  into: Map<string, WpblLeaderEntry>,
  board: WpblLeaderEntry[] | undefined,
  limit: number,
): void {
  for (const e of (board ?? []).slice(0, limit)) {
    if (!into.has(e.playerId)) into.set(e.playerId, e);
  }
}

/**
 * Transparent board MVP proxy from season leader boards (not official awards).
 * Weight: OPS×100 + HR×4 + RBI×1.5 + R×1 + SB×0.5 + H×0.15
 */
export function buildMvpWatch(
  leaders: WpblLeadersResponse,
  limit = 5,
): AwardCandidate[] {
  const ops = boardMap(leaders.batting.ops);
  const hr = boardMap(leaders.batting.hr);
  const rbi = boardMap(leaders.batting.rbi);
  const r = boardMap(leaders.batting.r);
  const sb = boardMap(leaders.batting.sb);
  const h = boardMap(leaders.batting.h);

  const pool = new Map<string, WpblLeaderEntry>();
  pushCandidates(pool, leaders.batting.ops, 15);
  pushCandidates(pool, leaders.batting.hr, 10);
  pushCandidates(pool, leaders.batting.rbi, 10);
  pushCandidates(pool, leaders.batting.avg, 10);

  const scored: AwardCandidate[] = [];
  for (const [playerId, base] of pool) {
    const opsV = ops.get(playerId)?.sortValue ?? 0;
    const hrV = hr.get(playerId)?.sortValue ?? 0;
    const rbiV = rbi.get(playerId)?.sortValue ?? 0;
    const rV = r.get(playerId)?.sortValue ?? 0;
    const sbV = sb.get(playerId)?.sortValue ?? 0;
    const hV = h.get(playerId)?.sortValue ?? 0;
    const score =
      opsV * 100 + hrV * 4 + rbiV * 1.5 + rV * 1 + sbV * 0.5 + hV * 0.15;

    const highlights: string[] = [];
    if (ops.has(playerId)) highlights.push(`OPS ${ops.get(playerId)!.value}`);
    if (hrV > 0) highlights.push(`${hr.get(playerId)!.value} HR`);
    if (rbiV > 0) highlights.push(`${rbi.get(playerId)!.value} RBI`);

    scored.push({
      playerId,
      name: base.name,
      teamAbbr: base.teamAbbr,
      headshotUrl: base.headshotUrl,
      position: base.position,
      score,
      scoreLabel: score.toFixed(1),
      highlights,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

/**
 * Transparent Cy Young proxy: SO + W×5 − ERA×8 − WHIP×6 + IP×0.4
 * (IP sortValue is outs pitched in leaders.)
 */
export function buildCyWatch(
  leaders: WpblLeadersResponse,
  limit = 5,
): AwardCandidate[] {
  const so = boardMap(leaders.pitching.so);
  const w = boardMap(leaders.pitching.w);
  const era = boardMap(leaders.pitching.era);
  const whip = boardMap(leaders.pitching.whip);
  const ip = boardMap(leaders.pitching.ip);

  const pool = new Map<string, WpblLeaderEntry>();
  pushCandidates(pool, leaders.pitching.so, 12);
  pushCandidates(pool, leaders.pitching.era, 12);
  pushCandidates(pool, leaders.pitching.w, 10);
  pushCandidates(pool, leaders.pitching.whip, 10);

  const scored: AwardCandidate[] = [];
  for (const [playerId, base] of pool) {
    const soV = so.get(playerId)?.sortValue ?? 0;
    const wV = w.get(playerId)?.sortValue ?? 0;
    const eraV = era.get(playerId)?.sortValue ?? 0;
    const whipV = whip.get(playerId)?.sortValue ?? 0;
    const ipOuts = ip.get(playerId)?.sortValue ?? 0;
    const ipInnings = ipOuts / 3;
    const score =
      soV + wV * 5 - eraV * 8 - whipV * 6 + ipInnings * 0.4;

    const highlights: string[] = [];
    if (era.has(playerId)) highlights.push(`ERA ${era.get(playerId)!.value}`);
    if (soV > 0) highlights.push(`${so.get(playerId)!.value} SO`);
    if (wV > 0) highlights.push(`${w.get(playerId)!.value} W`);

    scored.push({
      playerId,
      name: base.name,
      teamAbbr: base.teamAbbr,
      headshotUrl: base.headshotUrl,
      position: base.position,
      score,
      scoreLabel: score.toFixed(1),
      highlights,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

export type TeamSeriesRecord = {
  teamA: string;
  teamB: string;
  aWins: number;
  bWins: number;
  ties: number;
  gamesPlayed: number;
  aRuns: number;
  bRuns: number;
};

const TEAM_ORDER = ["LA", "NY", "SF", "BOS"] as const;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Season series records between each team pair (finals only). */
export function buildTeamSeries(
  games: WpblScheduleGame[],
): TeamSeriesRecord[] {
  const map = new Map<
    string,
    {
      teamA: string;
      teamB: string;
      aWins: number;
      bWins: number;
      ties: number;
      aRuns: number;
      bRuns: number;
    }
  >();

  for (const a of TEAM_ORDER) {
    for (const b of TEAM_ORDER) {
      if (a >= b) continue;
      map.set(pairKey(a, b), {
        teamA: a,
        teamB: b,
        aWins: 0,
        bWins: 0,
        ties: 0,
        aRuns: 0,
        bRuns: 0,
      });
    }
  }

  for (const game of games) {
    if (game.status !== "final") continue;
    if (game.awayRuns == null || game.homeRuns == null) continue;
    const key = pairKey(game.awayAbbr, game.homeAbbr);
    const row = map.get(key);
    if (!row) continue;

    const awayIsA = game.awayAbbr === row.teamA;
    const aRuns = awayIsA ? game.awayRuns : game.homeRuns;
    const bRuns = awayIsA ? game.homeRuns : game.awayRuns;
    row.aRuns += aRuns;
    row.bRuns += bRuns;
    if (aRuns > bRuns) row.aWins += 1;
    else if (bRuns > aRuns) row.bWins += 1;
    else row.ties += 1;
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      gamesPlayed: row.aWins + row.bWins + row.ties,
    }))
    .filter((row) => row.gamesPlayed > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
}
