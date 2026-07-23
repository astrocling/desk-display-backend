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
  /** Opponent abbreviation for the described non-live game; null when live / no game. */
  opponentAbbr: string | null;
  /** Configured team's home/away for that game; null when live / no game. */
  homeAway: "home" | "away" | null;
}

export interface FlagstandRaceSummary {
  id: string;
  name: string;
  scheduledAt: string;
  trackName: string | null;
  leagueName: string;
  seasonName: string;
}

export interface FlagstandNextRace extends FlagstandRaceSummary {
  status: string;
}

export interface FlagstandScores {
  lastResult: FlagstandRaceSummary | null;
  nextRace: FlagstandNextRace | null;
}

export interface ScoresBlob {
  mlb: MlbScores;
  flagstand: FlagstandScores;
  updatedAt: string;
}
