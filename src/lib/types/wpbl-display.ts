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
 * TrackMan / tracking measurement from `boxscore.tracking_activity`
 * (and live `tracking_activity_updated` websocket envelopes).
 */
export interface WpblTrackingEvent {
  activityId: string;
  kind: "pitch" | "hit" | "other";
  sequence: number | null;
  occurredAt: string | null;
  inning: number | null;
  half: "top" | "bottom" | null;
  batterName: string | null;
  pitcherName: string | null;
  batterId: string | null;
  pitcherId: string | null;
  pitchType: string | null;
  hitType: string | null;
  releaseSpeed: number | null;
  exitSpeed: number | null;
  speedUnit: string | null;
  spinRateRpm: number | null;
  launchAngleDeg: number | null;
  distance: number | null;
  distanceUnit: string | null;
  strikeZoneDecision: string | null;
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
    /** TrackMan activity oldest-first; empty when tracking is offline. */
    tracking: WpblTrackingEvent[];
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
  /** Absolute headshot URL when resolved; null when unknown. */
  headshotUrl: string | null;
  stats: Record<string, string | number | null>; // mapped display columns
}

/** Season player detail page payload (`GET /api/wpbl/players/[id]`). */
export interface WpblPlayerDetailResponse {
  updatedAt: string;
  seasonId: string;
  partial: boolean;
  player: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    teamId: string;
    teamAbbr: string;
    teamName: string;
    position: string | null;
    uniform: string | null;
    bats: string | null;
    throws: string | null;
    hometown: string | null;
    birthdate: string | null;
    status: string | null;
    headshotUrl: string | null;
    profileUrl: string | null;
  };
  season: {
    sourceThrough: string | null;
    batting: WpblPlayerBattingSeason | null;
    pitching: WpblPlayerPitchingSeason | null;
    fielding: WpblPlayerFieldingSeason | null;
  };
  gameLog: WpblPlayerGameLogEntry[];
}

export interface WpblPlayerBattingSeason {
  g: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  hbp: number;
  sf: number;
  sb: number;
  cs: number;
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
}

export interface WpblPlayerPitchingSeason {
  g: number;
  gs: number;
  w: number;
  l: number;
  sv: number;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  era: string | null;
  whip: string | null;
}

export interface WpblPlayerFieldingSeason {
  g: number;
  po: number;
  a: number;
  e: number;
  tc: number;
  dp: number;
  fpct: string | null;
}

export interface WpblPlayerGameLogEntry {
  gameId: string;
  startIso: string | null;
  side: "away" | "home";
  result: "W" | "L" | "T" | null;
  teamRuns: number | null;
  opponentRuns: number | null;
  opponentAbbr: string;
  opponentName: string;
  isFinal: boolean;
  batting: Record<string, string | number | null> | null;
  pitching: Record<string, string | number | null> | null;
  fielding: Record<string, string | number | null> | null;
}
