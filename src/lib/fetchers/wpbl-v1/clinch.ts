import type { WpblScheduleGame, WpblStandingRow } from "@/lib/types/wpbl-display";

/** WPBL plays in Springfield, IL — use Central for “remaining today” cutoffs. */
const CLINCH_TZ = "America/Chicago";

function calendarDateInTz(isoOrDate: string | Date, timeZone: string): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Games still able to change a team’s win total for seeding. */
export function isRemainingRegularSeasonGame(
  game: WpblScheduleGame,
  now: Date = new Date(),
): boolean {
  if (game.status === "final") return false;
  if (!game.countsInStandings) return false;
  if (game.gameType === "postseason") return false;
  if (!game.startIso) return false;
  const gameDay = calendarDateInTz(game.startIso, CLINCH_TZ);
  const today = calendarDateInTz(now, CLINCH_TZ);
  if (!gameDay || !today) return false;
  // Drop past-dated “ghost” scheduled slots that never resolved to Final.
  return gameDay >= today;
}

function remainingWinsByTeam(
  games: WpblScheduleGame[],
  now: Date,
): Map<string, number> {
  const remaining = new Map<string, number>();
  for (const game of games) {
    if (!isRemainingRegularSeasonGame(game, now)) continue;
    remaining.set(game.awayAbbr, (remaining.get(game.awayAbbr) ?? 0) + 1);
    remaining.set(game.homeAbbr, (remaining.get(game.homeAbbr) ?? 0) + 1);
  }
  return remaining;
}

/**
 * Derive sole clinched playoff seeds from current W-L + remaining RS games.
 *
 * WPBL: all four teams qualify; seeding is 1–4 from regular-season standings.
 * Upstream `/v1/teams/.../stats` has no clinch fields, so we compute when a
 * team’s win range locks a unique seed (ties assumed unresolved → no clinch).
 */
export function applyClinchedSeeds(
  standings: WpblStandingRow[],
  games: WpblScheduleGame[],
  now: Date = new Date(),
): WpblStandingRow[] {
  if (standings.length === 0) return standings;

  const remaining = remainingWinsByTeam(games, now);
  const ranges = standings.map((row) => {
    const rem = remaining.get(row.abbr) ?? 0;
    return {
      abbr: row.abbr,
      minWins: row.w,
      maxWins: row.w + rem,
    };
  });

  const clinched = new Map<string, number>();
  for (const team of ranges) {
    let bestSeed = 1;
    let worstSeed = 1;
    for (const other of ranges) {
      if (other.abbr === team.abbr) continue;
      if (other.minWins > team.maxWins) bestSeed += 1;
      // Equal max wins can still pass via unknown tiebreakers — treat as threat.
      if (other.maxWins >= team.minWins) worstSeed += 1;
    }
    if (bestSeed === worstSeed) {
      clinched.set(team.abbr, bestSeed);
    }
  }

  return standings.map((row) => ({
    ...row,
    clinchedSeed: clinched.get(row.abbr) ?? null,
  }));
}
