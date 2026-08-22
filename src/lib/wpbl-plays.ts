import type {
  WpblBoxPlayerLine,
  WpblLiveSituation,
  WpblPitchEvent,
  WpblPlay,
} from "@/lib/types/wpbl-display";
import { findPlayerLine, normalizePlayerName } from "@/lib/wpbl-player-match";

/** Newest play by sequence, or null when empty. */
export function latestWpblPlay(plays: WpblPlay[]): WpblPlay | null {
  if (!plays.length) return null;
  return plays.reduce((best, play) =>
    play.sequence >= best.sequence ? play : best,
  );
}

/** Newest-first list; optionally scoring plays only. */
export function filterWpblPlays(
  plays: WpblPlay[],
  mode: "all" | "scoring",
): WpblPlay[] {
  const filtered =
    mode === "scoring" ? plays.filter((p) => p.isScoringPlay) : plays;
  return [...filtered].sort((a, b) => b.sequence - a.sequence);
}

export function formatPlayInning(play: WpblPlay): string {
  if (play.half === "top") return `Top ${play.inning}`;
  if (play.half === "bottom") return `Bot ${play.inning}`;
  return `Inn ${play.inning}`;
}

/** Short last-token label for diamond runner chips. */
export function shortRunnerLabel(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] ?? trimmed;
}

const PITCH_CODE_META: Record<
  string,
  { type: string; description: string; kind: "ball" | "strike" | "foul" | "in_play" | "other" }
> = {
  B: { type: "ball", description: "Ball", kind: "ball" },
  K: { type: "called_strike", description: "Called strike", kind: "strike" },
  S: { type: "swinging_strike", description: "Swinging strike", kind: "strike" },
  C: { type: "called_strike", description: "Called strike", kind: "strike" },
  F: { type: "foul", description: "Foul", kind: "foul" },
  H: { type: "hit_by_pitch", description: "Hit by pitch", kind: "other" },
  P: { type: "in_play", description: "In play", kind: "in_play" },
  X: { type: "in_play", description: "In play", kind: "in_play" },
};

/** Expand compact pitch codes (e.g. "BBKSBP") into display pitch events. */
export function decodePitchSequence(
  sequence: string | null | undefined,
): WpblPitchEvent[] {
  const raw = sequence?.trim().toUpperCase();
  if (!raw) return [];
  const events: WpblPitchEvent[] = [];
  let i = 0;
  for (const code of raw) {
    if (!/[A-Z]/.test(code)) continue;
    i += 1;
    const meta = PITCH_CODE_META[code] ?? {
      type: "unknown",
      description: code,
      kind: "other" as const,
    };
    events.push({
      sequence: i,
      code,
      type: meta.type,
      description: meta.description,
    });
  }
  return events;
}

export function pitchKind(
  event: WpblPitchEvent,
): "ball" | "strike" | "foul" | "in_play" | "other" {
  const fromCode = PITCH_CODE_META[event.code.toUpperCase()]?.kind;
  if (fromCode) return fromCode;
  const t = event.type.toLowerCase();
  if (t.includes("ball") && !t.includes("hit")) return "ball";
  if (t.includes("foul")) return "foul";
  if (t.includes("strike")) return "strike";
  if (t.includes("play") || t.includes("pitchout")) return "in_play";
  return "other";
}

/** Prefer structured pitch_events; fall back to decoding pitch_sequence. */
export function pitchesFromPlay(play: WpblPlay): WpblPitchEvent[] {
  if (play.pitchEvents.length > 0) return play.pitchEvents;
  return decodePitchSequence(play.pitchSequence);
}

export type AtBatPitchLog = {
  pitches: WpblPitchEvent[];
  /** current = matches live batter; last = prior completed PA shown for context */
  source: "current" | "last" | null;
  label: string | null;
};

/**
 * Pitch log for the scoreboard under the count.
 * Mid-PA pitches are not published until the plate appearance ends, so we
 * show the latest completed PA — labeled "This at-bat" when it still matches
 * the live batter, otherwise "Last at-bat".
 */
export function atBatPitchLog(
  situation: WpblLiveSituation | null,
  plays: WpblPlay[],
): AtBatPitchLog {
  const latest = latestWpblPlay(plays);
  if (!latest) {
    return { pitches: [], source: null, label: null };
  }

  const pitches = pitchesFromPlay(latest);
  if (!pitches.length) {
    return { pitches: [], source: null, label: null };
  }

  const batter = situation?.batterName;
  if (namesLooselyMatch(batter, latest.batterName)) {
    return { pitches, source: "current", label: "This at-bat" };
  }

  return { pitches, source: "last", label: "Last at-bat" };
}

function namesLooselyMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const na = normalizePlayerName(a);
  const nb = normalizePlayerName(b);
  if (na === nb) return true;
  const aLast = na.split(" ").at(-1);
  const bLast = nb.split(" ").at(-1);
  return Boolean(aLast && aLast === bLast);
}

export type LineupFollowers = {
  battingSide: "away" | "home" | null;
  batter: WpblBoxPlayerLine | null;
  onDeck: WpblBoxPlayerLine | null;
  inHole: WpblBoxPlayerLine | null;
};

/** Unique batting-order slots for a side (first player wins duplicate spots). */
export function lineupForSide(
  batting: WpblBoxPlayerLine[],
  side: "away" | "home",
): WpblBoxPlayerLine[] {
  const seen = new Set<number>();
  const ordered: WpblBoxPlayerLine[] = [];
  const candidates = batting
    .filter((p) => p.side === side && p.battingOrder != null)
    .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0));
  for (const player of candidates) {
    const spot = player.battingOrder!;
    if (seen.has(spot)) continue;
    seen.add(spot);
    ordered.push(player);
  }
  return ordered;
}

/**
 * On-deck / in-the-hole from the batting team's order relative to the live batter.
 */
export function lineupFollowers(
  batting: WpblBoxPlayerLine[],
  situation: WpblLiveSituation | null,
): LineupFollowers {
  const battingSide: "away" | "home" | null =
    situation?.half === "top"
      ? "away"
      : situation?.half === "bottom"
        ? "home"
        : null;

  if (!battingSide) {
    return { battingSide: null, batter: null, onDeck: null, inHole: null };
  }

  const lineup = lineupForSide(batting, battingSide);
  const batter = findPlayerLine(lineup, situation?.batterName);
  if (!batter || lineup.length === 0) {
    return { battingSide, batter, onDeck: null, inHole: null };
  }

  const idx = lineup.findIndex(
    (p) => normalizePlayerName(p.name) === normalizePlayerName(batter.name),
  );
  if (idx < 0) {
    return { battingSide, batter, onDeck: null, inHole: null };
  }

  const onDeck = lineup[(idx + 1) % lineup.length] ?? null;
  const inHole =
    lineup.length > 1 ? (lineup[(idx + 2) % lineup.length] ?? null) : null;

  return {
    battingSide,
    batter,
    onDeck: onDeck?.name === batter.name ? null : onDeck,
    inHole:
      inHole && inHole.name !== batter.name && inHole.name !== onDeck?.name
        ? inHole
        : null,
  };
}
