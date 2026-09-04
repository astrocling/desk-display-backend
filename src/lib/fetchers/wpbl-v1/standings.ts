import type { WpblStandingRow } from "@/lib/types/wpbl-display";
import { fetchWpblJson } from "./client";
import { FALLBACK_SEASON_ID, teamFromId, WPBL_TEAMS } from "./teams";

interface WpblApiStanding {
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  winning_percentage: number;
  games_behind: number;
  runs_for: number;
  runs_against: number;
  run_differential: number;
  last_ten?: {
    wins: number;
    losses: number;
    ties?: number;
  } | null;
  streak?: {
    type: string;
    length: number;
  } | null;
}

export interface WpblTeamStatsPayload {
  team_id: string;
  standing: WpblApiStanding;
}

export function formatGb(gamesBehind: number): string {
  if (!Number.isFinite(gamesBehind) || gamesBehind === 0) return "—";
  return String(gamesBehind);
}

export function formatPct(winningPercentage: number): string | null {
  if (!Number.isFinite(winningPercentage)) return null;
  return winningPercentage.toFixed(3).replace(/^0/, "");
}

function formatL10(lastTen: WpblApiStanding["last_ten"]): string | null {
  if (!lastTen) return null;
  return `${lastTen.wins}-${lastTen.losses}`;
}

function formatStreak(streak: WpblApiStanding["streak"]): string | null {
  if (!streak?.type) return null;
  return `${streak.type}${streak.length}`;
}

export function mapTeamStatsToStanding(
  stats: WpblTeamStatsPayload,
): WpblStandingRow | null {
  const team = teamFromId(stats.team_id);
  if (!team) return null;

  const { standing } = stats;
  return {
    teamId: stats.team_id,
    abbr: team.abbr,
    name: team.name,
    rank: standing.rank,
    w: standing.wins,
    l: standing.losses,
    t: standing.ties,
    pct: formatPct(standing.winning_percentage),
    gb: formatGb(standing.games_behind),
    rf: standing.runs_for,
    ra: standing.runs_against,
    diff: standing.run_differential,
    l10: formatL10(standing.last_ten),
    streak: formatStreak(standing.streak),
    clinchedSeed: null,
  };
}

export async function fetchWpblStandings(
  seasonId: string = FALLBACK_SEASON_ID,
): Promise<WpblStandingRow[]> {
  const teamIds = Object.keys(WPBL_TEAMS);
  const results = await Promise.allSettled(
    teamIds.map((id) =>
      fetchWpblJson<WpblTeamStatsPayload>(
        `/v1/teams/${id}/stats?season_id=${seasonId}`,
      ),
    ),
  );

  return results
    .flatMap((result) =>
      result.status === "fulfilled"
        ? [mapTeamStatsToStanding(result.value)]
        : [],
    )
    .filter((row): row is WpblStandingRow => row != null)
    .sort((a, b) => a.rank - b.rank);
}
