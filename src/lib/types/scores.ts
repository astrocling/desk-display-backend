export interface MlbScores {
  /** True when the configured team's game is in progress. */
  live: boolean;
  /**
   * `{teamScore}-{opponentScore}` for the configured MLB_TEAM (e.g. HOU 4, opponent 2 → `"4-2"`).
   * Null when no score is available yet (scheduled game).
   */
  score: string | null;
  /** e.g. `"Top 7"` while live; null otherwise. */
  inning: string | null;
  /** ISO start time for the next upcoming game when not live. */
  nextGame: string | null;

  /**
   * Baseball-style matchup using nicknames for MLB_TEAM vs opponent.
   * Home: "Astros vs. Rangers"
   * Away: "Astros @ Rangers"
   * Null when no upcoming/current non-live game context.
   */
  matchup: string | null;

  /**
   * Next/upcoming tip-off in America/New_York.
   * Format: "Fri 7/24 7:40 PM" (abbrev weekday, no leading zero on month/day/hour).
   * Null when no nextGame.
   */
  whenEt: string | null;

  /** Overall W-L for MLB_TEAM, e.g. "50-54". Null if standings unavailable. */
  record: string | null;

  /**
   * Division line for MLB_TEAM, e.g. "3rd AL West · 2 GB" or "1st AL West · 1.5 GU".
   * Null if standings unavailable.
   */
  standingLine: string | null;

  /** Configured MLB_TEAM abbreviation, e.g. "HOU". */
  teamAbbr: string | null;
  /**
   * Opponent abbreviation for the current (live) or next (not-live) game.
   * Null when no game context.
   */
  opponentAbbr: string | null;
  /** Configured team's home/away for that game; null when no game. */
  homeAway: "home" | "away" | null;

  /** Configured team runs while live (or final); null when not applicable. */
  teamRuns: number | null;
  /** Opponent runs while live (or final); null when not applicable. */
  opponentRuns: number | null;

  /** Live count / situation — null when not live or unavailable. */
  balls: number | null;
  strikes: number | null;
  outs: number | null;
  onFirst: boolean | null;
  onSecond: boolean | null;
  onThird: boolean | null;
  /** Prefer ESPN shortName, e.g. "M. Murakami". */
  batterName: string | null;
  /** Season AVG display while live, e.g. ".222". */
  batterAvg: string | null;
  /** Game line from ESPN situation, e.g. "1-3, BB". */
  batterSummary: string | null;
  pitcherName: string | null;
  /** Season ERA display while live, e.g. "1.93". */
  pitcherEra: string | null;
  /** Game line from ESPN situation, e.g. "0.2 IP, 0 ER, 0 H, K, BB". */
  pitcherSummary: string | null;
}

export interface FlagstandRaceSummary {
  id: string;
  name: string;
  scheduledAt: string;
  trackName: string | null;
  leagueName: string;
  /** iRacing / hub season label (Season.name). */
  seasonName: string;
  /** Linked Series.name for card display; null when season has no series. */
  seriesName: string | null;
}

export interface FlagstandNextRace extends FlagstandRaceSummary {
  status: string;
}

export interface FlagstandScores {
  lastResult: FlagstandRaceSummary | null;
  nextRace: FlagstandNextRace | null;
}

export type WpblGameStatus = "scheduled" | "live" | "final";

export interface WpblGame {
  status: WpblGameStatus;
  inning: string | null;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string | null;
  homeName: string | null;
  awayRuns: number | null;
  homeRuns: number | null;
  whenEt: string | null;
  /** ISO start for refresh gating; null if unknown. */
  startIso: string | null;
}

export interface WpblStanding {
  abbr: string;
  name: string;
  w: number;
  l: number;
  pct: string | null;
  gb: string | null;
}

export interface WpblScores {
  games: WpblGame[];
  standings: WpblStanding[];
}

export interface ScoresBlob {
  mlb: MlbScores;
  flagstand: FlagstandScores;
  wpbl: WpblScores;
  updatedAt: string;
}
