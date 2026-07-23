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
