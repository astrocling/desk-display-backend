import type { WpblPlay } from "@/lib/types/wpbl-display";

import { shortRunnerLabel } from "@/lib/wpbl-plays";

const EVENT_TYPE_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  home_run: "Home Run",
  homer: "Home Run",
  walk: "Walk",
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
  sac_fly: "Sac Fly",
  sacrifice_fly: "Sac Fly",
  sac_bunt: "Sac Bunt",
  sacrifice_bunt: "Sac Bunt",
  hit_by_pitch: "HBP",
  error: "Error",
  fielders_choice: "Fielder's Choice",
  fielder_choice: "Fielder's Choice",
  double_play: "Double Play",
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
  /defensive (?:switch|substitution)|pinch (?:hit|run) for/i;

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
  if (/\bsingled\b/.test(n)) return "Single";
  if (/\bdoubled\b/.test(n)) return "Double";
  if (/\btripled\b/.test(n)) return "Triple";
  if (/\bwalked\b|\bwalk\b/.test(n)) return "Walk";
  if (/\bstruck out\b|\bstrikeout\b/.test(n)) return "Strikeout";
  if (/\bgrounded out\b|\bgroundout\b/.test(n)) return "Groundout";
  if (/\bflied out\b|\bflies out\b|\bflyout\b/.test(n)) return "Flyout";
  if (/\blined out\b/.test(n)) return "Lineout";
  if (/\bpopped out\b/.test(n)) return "Popout";
  if (/\bsacrifice fly\b|\bsac fly\b/.test(n)) return "Sac Fly";
  if (/\bsacrifice bunt\b|\bsac bunt\b/.test(n)) return "Sac Bunt";
  if (/\breached first on an error\b|\berror by\b/.test(n)) return "Error";
  if (/\bhit by pitch\b/.test(n)) return "HBP";
  if (/\bstole\b/.test(n)) return "Stolen Base";
  if (/\bcaught stealing\b/.test(n)) return "Caught Stealing";
  if (/\bpickoff\b/.test(n)) return "Pickoff";
  if (/\bwild pitch\b/.test(n)) return "Wild Pitch";
  if (/\bpassed ball\b/.test(n)) return "Passed Ball";
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

export type PlayTimelineItem =
  | { kind: "play"; play: WpblPlay }
  | { kind: "bases"; play: WpblPlay; key: string };

/**
 * Newest-first timeline. WPBL play base fields are the situation *before*
 * the play, so we attach each play's own runners under that play — not the
 * next row's (which was shifting base state one at-bat later).
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
