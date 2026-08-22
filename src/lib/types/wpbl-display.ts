export interface WpblLeagueResponse {
  updatedAt: string;
  seasonId: string;
  standings: WpblStandingRow[];
  games: WpblScheduleGame[];
}

export interface WpblStandingRow {
  teamId: string;
  abbr: string; // LA | NY | SF | BOS
  name: string; // Queens | Heights | …
  rank: number;
  w: number;
  l: number;
  t: number;
  pct: string | null;
  gb: string | null;
  rf: number;
  ra: number;
  diff: number;
  l10: string | null; // e.g. "5-3"
  streak: string | null; // e.g. "L1"
}

export type WpblGameStatus = "scheduled" | "live" | "final" | "other";

export interface WpblScheduleGame {
  id: string;
  status: WpblGameStatus;
  startIso: string | null;
  whenEt: string | null;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string;
  homeName: string;
  awayRuns: number | null;
  homeRuns: number | null;
  venue: string | null;
  countsInStandings: boolean;
}

export interface WpblLeadersResponse {
  updatedAt: string;
  seasonId: string;
  partial: boolean; // true if some player fetches failed
  qualifiers: {
    /** Floor for AVG (and any other rate batting boards). Default **10 AB**. */
    battingMinAb: number;
  };
  batting: {
    avg: WpblLeaderEntry[];
    hr: WpblLeaderEntry[];
    rbi: WpblLeaderEntry[];
    h: WpblLeaderEntry[];
  };
  pitching: {
    era: WpblLeaderEntry[];
    so: WpblLeaderEntry[];
    w: WpblLeaderEntry[];
    sv: WpblLeaderEntry[];
  };
}

export interface WpblLeaderEntry {
  playerId: string;
  name: string;
  teamAbbr: string;
  value: string; // display-ready, e.g. ".312", "7", "1.93"
  sortValue: number; // for stable ranking
  /** Roster position when known (e.g. "CF", "P"); null when unknown. */
  position: string | null;
  /** Absolute headshot URL when available; null when unknown. */
  headshotUrl: string | null;
}

/** Live count / base / batter-pitcher snapshot from the WPBL boxscore status. */
export interface WpblLiveSituation {
  /** Current inning number when known (for line-score highlight). */
  inningNumber: number | null;
  half: "top" | "bottom" | null;
  balls: number | null;
  strikes: number | null;
  outs: number | null;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  /** Runner name on first when occupied; null when empty/unknown. */
  runnerFirst: string | null;
  runnerSecond: string | null;
  runnerThird: string | null;
  batterName: string | null;
  pitcherName: string | null;
}

/** Single pitch within an at-bat from the official play feed. */
export interface WpblPitchEvent {
  sequence: number;
  code: string;
  type: string;
  description: string;
}

/**
 * One play from the WPBL boxscore `plays` array (official narrative feed).
 * Sequence increases through the game; UI usually shows newest first.
 */
export interface WpblPlay {
  sequence: number;
  inning: number;
  half: "top" | "bottom" | null;
  outs: number | null;
  batterName: string | null;
  pitcherName: string | null;
  runnerFirst: string | null;
  runnerSecond: string | null;
  runnerThird: string | null;
  narrative: string;
  eventType: string;
  isHit: boolean;
  isScoringPlay: boolean;
  runsScored: number;
  /** Compact pitch codes, e.g. "BBKSBP". */
  pitchSequence: string | null;
  pitchEvents: WpblPitchEvent[];
  finalBalls: number | null;
  finalStrikes: number | null;
  finalFouls: number | null;
}

export interface WpblGameDetailResponse {
  updatedAt: string;
  game: WpblScheduleGame & {
    /** Live/final inning label when known, e.g. "Top 5"; null otherwise. */
    inning: string | null;
    /** Populated while live when the boxscore status has situation fields. */
    situation: WpblLiveSituation | null;
  };
  boxscore: {
    available: boolean;
    lineScore: {
      maxInning: number;
      teams: Array<{
        side: "away" | "home";
        abbr: string;
        name: string;
        innings: Array<{ inning: number; runs: number | null }>;
        runs: number | null;
        hits: number | null;
        errors: number | null;
        lob: number | null;
      }>;
    } | null;
    batting: WpblBoxPlayerLine[];
    pitching: WpblBoxPlayerLine[];
    /** Chronological play-by-play (oldest first). Empty when not yet published. */
    plays: WpblPlay[];
  };
}

export interface WpblBoxPlayerLine {
  side: "away" | "home";
  name: string;
  /** WPBL player id when present on the boxscore payload. */
  playerId: string | null;
  position: string | null;
  /** Batting-order spot (1–9+) when present; null for pitchers-only / unknown. */
  battingOrder: number | null;
  /** Jersey number string when present. */
  uniform: string | null;
  stats: Record<string, string | number | null>; // mapped display columns
}
