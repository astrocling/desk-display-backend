import type { WpblPlay } from "@/lib/types/wpbl-display";

import {
  pitchKind,
  pitchesFromPlay,
  shortRunnerLabel,
} from "@/lib/wpbl-plays";

const EVENT_TYPE_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  home_run: "Home Run",
  homer: "Home Run",
  walk: "Walk",
  intentional_walk: "Intent Walk",
  intent_walk: "Intent Walk",
  strikeout: "Strikeout",
  strike_out: "Strikeout",
  groundout: "Groundout",
  ground_out: "Groundout",
  flyout: "Flyout",
  fly_out: "Flyout",
  lineout: "Lineout",
  line_out: "Lineout",
  popout: "Popout",
  pop_out: "Popout",
  forceout: "Forceout",
  force_out: "Forceout",
  sac_fly: "Sac Fly",
  sacrifice_fly: "Sac Fly",
  sac_bunt: "Sac Bunt",
  sacrifice_bunt: "Sac Bunt",
  hit_by_pitch: "HBP",
  error: "Error",
  fielders_choice: "Fielder's Choice",
  fielder_choice: "Fielder's Choice",
  double_play: "Double Play",
  grounded_into_dp: "Double Play",
  triple_play: "Triple Play",
  wild_pitch: "Wild Pitch",
  passed_ball: "Passed Ball",
  balk: "Balk",
  stolen_base: "Stolen Base",
  caught_stealing: "Caught Stealing",
  pickoff: "Pickoff",
};

/** True subs only — must not match "lined out to 3b" / "flied out to cf". */
const SUBSTITUTION_NARRATIVE =
  /^(?:[\w'.-]+(?:\s+[\w'.-]+){0,5})\s+to\s+(?:p|c|lf|cf|rf|ss|1b|2b|3b|dh)\.?$/i;
const ADMIN_NARRATIVE =
  /defensive (?:switch|substitution)|pinch (?:hit|run) for|injury delay|game advisory/i;

const FIELDER_ABBR: Record<string, string> = {
  p: "pitcher",
  c: "catcher",
  "1b": "first baseman",
  "2b": "second baseman",
  "3b": "third baseman",
  ss: "shortstop",
  lf: "left fielder",
  cf: "center fielder",
  rf: "right fielder",
  dh: "designated hitter",
};

/** Short display label for the play outcome pill (MLB-style). */
export function playTypeLabel(play: WpblPlay): string | null {
  const key = play.eventType?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (key && key !== "unknown" && EVENT_TYPE_LABELS[key]) {
    return EVENT_TYPE_LABELS[key];
  }
  return inferPlayTypeFromNarrative(play.narrative);
}

function inferPlayTypeFromNarrative(narrative: string): string | null {
  const n = narrative.toLowerCase();
  if (/\bhomers?\b|\bhome run\b/.test(n)) return "Home Run";
  if (/\bsingled?\b/.test(n)) return "Single";
  if (/\bdoubled?\b/.test(n)) return "Double";
  if (/\btripled?\b/.test(n)) return "Triple";
  if (/\bwalked\b|\bwalks\b|\bwalk\b/.test(n)) return "Walk";
  if (/\bstruck out\b|\bstrikes out\b|\bstrikeout\b/.test(n)) return "Strikeout";
  if (/\bgrounds? into a force\b|\bforce ?out\b/.test(n)) return "Forceout";
  if (/\bgrounded out\b|\bgrounds out\b|\bgroundout\b/.test(n)) return "Groundout";
  if (/\bflied out\b|\bflies out\b|\bflyout\b/.test(n)) return "Flyout";
  if (/\blined out\b|\blines out\b/.test(n)) return "Lineout";
  if (/\bpopped out\b|\bpops out\b/.test(n)) return "Popout";
  if (/\bsacrifice fly\b|\bsac fly\b/.test(n)) return "Sac Fly";
  if (/\bsacrifice bunt\b|\bsac bunt\b/.test(n)) return "Sac Bunt";
  if (/\breached (?:first )?on an error\b|\breaches on (?:a )?(?:fielding )?error\b|\berror by\b/.test(n))
    return "Error";
  if (/\bhit by pitch\b/.test(n)) return "HBP";
  if (/\bstole\b|\bsteals\b/.test(n)) return "Stolen Base";
  if (/\bcaught stealing\b/.test(n)) return "Caught Stealing";
  if (/\bpickoff\b/.test(n)) return "Pickoff";
  if (/\bwild pitch\b/.test(n)) return "Wild Pitch";
  if (/\bpassed ball\b/.test(n)) return "Passed Ball";
  if (/\bdouble play\b|\bgdp\b/.test(n)) return "Double Play";
  return null;
}

/** Substitution / defensive moves — hide outcome pill (headshot still shown when named). */
export function isAdministrativePlay(play: WpblPlay): boolean {
  const narrative = play.narrative.trim();
  if (!narrative) return true;
  if (SUBSTITUTION_NARRATIVE.test(narrative)) return true;
  if (ADMIN_NARRATIVE.test(narrative)) return true;
  // Missing batter is only admin when the narrative isn't a normal plate result.
  if (!play.batterName?.trim()) {
    return (
      SUBSTITUTION_NARRATIVE.test(narrative) ||
      ADMIN_NARRATIVE.test(narrative) ||
      !inferPlayTypeFromNarrative(narrative)
    );
  }
  return false;
}

export type BasesOccupancy = {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
};

export function basesFromPlay(play: WpblPlay): BasesOccupancy {
  return {
    onFirst: Boolean(play.runnerFirst?.trim()),
    onSecond: Boolean(play.runnerSecond?.trim()),
    onThird: Boolean(play.runnerThird?.trim()),
  };
}

export function basesStateKey(play: WpblPlay): string {
  return [
    play.runnerFirst?.trim() ?? "",
    play.runnerSecond?.trim() ?? "",
    play.runnerThird?.trim() ?? "",
  ].join("|");
}

/** Runner summary for timeline nodes, e.g. "Turner on 1st, Crawford on 3rd". */
export function formatBasesState(play: WpblPlay): string {
  const first = play.runnerFirst?.trim();
  const second = play.runnerSecond?.trim();
  const third = play.runnerThird?.trim();
  if (!first && !second && !third) return "Bases empty";

  const parts: string[] = [];
  if (first) parts.push(`${shortRunnerLabel(first) ?? first} on 1st`);
  if (second) parts.push(`${shortRunnerLabel(second) ?? second} on 2nd`);
  if (third) parts.push(`${shortRunnerLabel(third) ?? third} on 3rd`);
  return parts.join(", ");
}

export function battingTeamAbbr(
  play: WpblPlay,
  awayAbbr: string,
  homeAbbr: string,
): string | null {
  if (play.half === "top") return awayAbbr;
  if (play.half === "bottom") return homeAbbr;
  return null;
}

export type PlayHalfInning = {
  key: string;
  inning: number;
  half: "top" | "bottom" | null;
  label: string;
  plays: WpblPlay[];
};

function inningOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** MLB-style half-inning header, e.g. "Top 3rd" / "Bottom 1st". */
export function formatHalfInningHeader(play: WpblPlay): string {
  const ord = inningOrdinal(play.inning);
  if (play.half === "top") return `Top ${ord}`;
  if (play.half === "bottom") return `Bottom ${ord}`;
  return `Inning ${ord}`;
}

export function halfInningKey(play: WpblPlay): string {
  return `${play.inning}-${play.half ?? "unk"}`;
}

/**
 * Group newest-first plays into half-inning sections (also newest-first).
 */
export function groupPlaysByHalfInning(playsNewestFirst: WpblPlay[]): PlayHalfInning[] {
  const groups: PlayHalfInning[] = [];
  for (const play of playsNewestFirst) {
    const key = halfInningKey(play);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.plays.push(play);
      continue;
    }
    groups.push({
      key,
      inning: play.inning,
      half: play.half,
      label: formatHalfInningHeader(play),
      plays: [play],
    });
  }
  return groups;
}

/**
 * Count entering the decisive (last) pitch — MLB situational "1 - 2".
 * Falls back to final balls/strikes when no pitch log is available.
 */
export function countEnteringOutcome(
  play: WpblPlay,
): { balls: number; strikes: number } | null {
  const pitches = pitchesFromPlay(play);
  if (pitches.length > 0) {
    let balls = 0;
    let strikes = 0;
    const prior = pitches.slice(0, -1);
    for (const pitch of prior) {
      const kind = pitchKind(pitch);
      if (kind === "ball") {
        balls = Math.min(3, balls + 1);
      } else if (kind === "strike") {
        strikes = Math.min(2, strikes + 1);
      } else if (kind === "foul") {
        if (strikes < 2) strikes += 1;
      }
    }
    return { balls, strikes };
  }

  if (play.finalBalls == null && play.finalStrikes == null) return null;
  let balls = play.finalBalls ?? 0;
  let strikes = play.finalStrikes ?? 0;
  // Walks publish 4 balls; show the 3-x count the batter saw.
  if (balls >= 4) balls = 3;
  if (strikes >= 3) strikes = 2;
  return { balls, strikes };
}

/** MLB situational line: "1 - 2, 0 Outs". */
export function formatSituationalLine(play: WpblPlay): string | null {
  if (isAdministrativePlay(play)) return null;
  const count = countEnteringOutcome(play);
  const outs = play.outs;
  if (count == null && outs == null) return null;

  const outsLabel =
    outs == null
      ? null
      : `${outs} Out${outs === 1 ? "" : "s"}`;

  if (count && outsLabel) {
    return `${count.balls} - ${count.strikes}, ${outsLabel}`;
  }
  if (count) return `${count.balls} - ${count.strikes}`;
  return outsLabel;
}

/**
 * How many outs this play recorded (best-effort from type / narrative).
 */
export function outsRecordedByPlay(play: WpblPlay): number {
  if (isAdministrativePlay(play)) return 0;
  const label = (playTypeLabel(play) ?? "").toLowerCase();
  const n = play.narrative.toLowerCase();

  if (label === "triple play" || /\btriple play\b/.test(n)) return 3;
  if (label === "double play" || /\bdouble play\b|\bgdp\b|\binto a double play\b/.test(n)) {
    return 2;
  }

  const outLabels = new Set([
    "strikeout",
    "groundout",
    "flyout",
    "lineout",
    "popout",
    "forceout",
    "sac fly",
    "sac bunt",
    "caught stealing",
    "pickoff",
  ]);
  if (outLabels.has(label)) return 1;

  // Runner thrown out on an otherwise non-out play (e.g. single + out at home).
  const runnerOuts = (n.match(/\bout at\b/g) ?? []).length;
  if (runnerOuts > 0 && !outLabels.has(label)) return runnerOuts;

  return 0;
}

/** Outs in the half-inning after this play resolves (0–3). */
export function outsAfterPlay(play: WpblPlay): number | null {
  if (play.outs == null) return null;
  return Math.min(3, Math.max(0, play.outs) + outsRecordedByPlay(play));
}

export function formatOutsPhrase(outs: number): string {
  if (outs <= 0) return "0 outs";
  if (outs >= 3) return "3 outs";
  return outs === 1 ? "1 out" : `${outs} outs`;
}

/**
 * Rewrite official WPBL narratives toward MLB Gameday summary voice:
 * present tense, no pitch-code parentheticals, expanded fielder roles.
 */
export function enrichPlayNarrative(narrative: string): string {
  let text = narrative.trim();
  if (!text) return text;

  // Drop pitch-count / pitch-code tails like "(0-1 F)" or "(3-2 BBBKFB)".
  text = text.replace(
    /\s*\(\d+\s*-\s*\d+(?:\s+[A-Z0-9]+)?\)\.?/g,
    (match) => (match.trimEnd().endsWith(".") ? "." : ""),
  );

  // "advanced to second" → "to 2nd"
  text = text.replace(
    /\badvanced to (first|second|third|home)\b/gi,
    (_m, base: string) => {
      const b = base.toLowerCase();
      if (b === "first") return "to 1st";
      if (b === "second") return "to 2nd";
      if (b === "third") return "to 3rd";
      return "scores";
    },
  );

  // Bare base advances already present as "to second"
  text = text.replace(/\bto first\b/gi, "to 1st");
  text = text.replace(/\bto second\b/gi, "to 2nd");
  text = text.replace(/\bto third\b/gi, "to 3rd");

  // Scoring language
  text = text.replace(/\bscored(?:,\s*unearned)?\b/gi, "scores");

  // Present-tense plate results
  const verbMap: Array<[RegExp, string]> = [
    [/\bhomered\b/gi, "homers"],
    [/\bsingled\b/gi, "singles"],
    [/\bdoubled\b/gi, "doubles"],
    [/\btripled\b/gi, "triples"],
    [/\bwalked\b/gi, "walks"],
    [/\bstruck out\b/gi, "strikes out"],
    [/\bgrounded out\b/gi, "grounds out"],
    [/\bgrounded into\b/gi, "grounds into"],
    [/\bflied out\b/gi, "flies out"],
    [/\blined out\b/gi, "lines out"],
    [/\bpopped out\b/gi, "pops out"],
    [/\breached first on an error\b/gi, "reaches on an error"],
    [/\breached on an error\b/gi, "reaches on an error"],
    [/\bstole\b/gi, "steals"],
    [/\bwas caught stealing\b/gi, "caught stealing"],
  ];
  for (const [pattern, replacement] of verbMap) {
    text = text.replace(pattern, replacement);
  }

  // Expand "error by ss" / "to ss" / "to 3b"
  text = text.replace(
    /\b(by|to)\s+(p|c|lf|cf|rf|ss|1b|2b|3b|dh)\b/gi,
    (_m, prep: string, abbr: string) => {
      const expanded = FIELDER_ABBR[abbr.toLowerCase()];
      return expanded ? `${prep} ${expanded}` : `${prep} ${abbr}`;
    },
  );

  // Soften awkward capitalization mid-sentence ("Davis Failed pickoff")
  text = text.replace(
    /(\w)\s+([A-Z][a-z]+(?:ed|ing)?)\b/g,
    (full, prev: string, word: string) => {
      const lower = word.toLowerCase();
      if (
        lower === "failed" ||
        lower === "called" ||
        lower === "dropped" ||
        lower === "wild"
      ) {
        return `${prev} ${lower}`;
      }
      return full;
    },
  );

  // Prefer semicolons → periods for MLB-like sentence breaks
  text = text.replace(/\s*;\s*/g, ". ");

  // Tidy whitespace / punctuation
  text = text.replace(/\s+/g, " ").replace(/\s+\./g, ".").replace(/\.\.+/g, ".");
  text = text.replace(/\s+,/g, ",").trim();
  if (text && !/[.!?]$/.test(text)) text += ".";

  return text;
}

export type PlaySummaryParts = {
  /** Enriched narrative without the trailing outs phrase. */
  body: string;
  /** Resulting outs phrase when known, e.g. "1 out". */
  outsPhrase: string | null;
};

/** Summary body + optional outs footer matching MLB Gameday. */
export function playSummaryParts(play: WpblPlay): PlaySummaryParts {
  const body = enrichPlayNarrative(play.narrative);
  if (isAdministrativePlay(play)) {
    return { body, outsPhrase: null };
  }
  const after = outsAfterPlay(play);
  if (after == null) return { body, outsPhrase: null };
  // Only show outs when the play changed them or ended the half.
  const recorded = outsRecordedByPlay(play);
  if (recorded <= 0 && after < 3) return { body, outsPhrase: null };
  return { body, outsPhrase: formatOutsPhrase(after) };
}

export type RunningScore = {
  away: number;
  home: number;
};

/**
 * Cumulative score after each play (sequence → score). Oldest plays first in input.
 */
export function runningScoresBySequence(
  playsOldestFirst: WpblPlay[],
): Map<number, RunningScore> {
  const map = new Map<number, RunningScore>();
  let away = 0;
  let home = 0;
  for (const play of playsOldestFirst) {
    if (play.runsScored > 0) {
      if (play.half === "top") away += play.runsScored;
      else if (play.half === "bottom") home += play.runsScored;
    }
    map.set(play.sequence, { away, home });
  }
  return map;
}

export function formatScoreLine(
  score: RunningScore,
  awayAbbr: string,
  homeAbbr: string,
): string {
  const away = awayAbbr.trim() || "Away";
  const home = homeAbbr.trim() || "Home";
  return `${away} ${score.away}, ${home} ${score.home}`;
}

/** @deprecated Prefer groupPlaysByHalfInning — kept for older call sites/tests. */
export type PlayTimelineItem =
  | { kind: "play"; play: WpblPlay }
  | { kind: "bases"; play: WpblPlay; key: string };

/**
 * Newest-first timeline. WPBL play base fields are the situation *before*
 * the play, so we attach each play's own runners under that play — not the
 * next row's (which was shifting base state one at-bat later).
 *
 * @deprecated Situational bases now render inline on each play card.
 */
export function buildPlayTimeline(playsNewestFirst: WpblPlay[]): PlayTimelineItem[] {
  const items: PlayTimelineItem[] = [];
  let lastBasesKey: string | null = null;

  for (const play of playsNewestFirst) {
    items.push({ kind: "play", play });

    const key = basesStateKey(play);
    if (key !== lastBasesKey) {
      items.push({ kind: "bases", play, key });
      lastBasesKey = key;
    }
  }

  return items;
}
