import type {
  WpblBoxPlayerLine,
  WpblLiveSituation,
  WpblPitchEvent,
  WpblPlay,
} from "@/lib/types/wpbl-display";
import {
  findPlayerLine,
  normalizePlayerName,
  playerNamesMatch,
} from "@/lib/wpbl-player-match";

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

type PitchKind = "ball" | "strike" | "foul" | "in_play" | "other";

type PitchMeta = {
  type: string;
  description: string;
  kind: PitchKind;
};

const PITCH_CODE_META: Record<string, PitchMeta> = {
  A: { type: "automatic_ball", description: "Automatic ball", kind: "ball" },
  B: { type: "ball", description: "Ball", kind: "ball" },
  C: { type: "called_strike", description: "Called strike", kind: "strike" },
  F: { type: "foul", description: "Foul", kind: "foul" },
  H: { type: "hit_by_pitch", description: "Hit by pitch", kind: "other" },
  I: { type: "intent_ball", description: "Intentional ball", kind: "ball" },
  K: { type: "called_strike", description: "Called strike", kind: "strike" },
  L: { type: "called_strike", description: "Called strike", kind: "strike" },
  O: { type: "pitchout", description: "Pitchout", kind: "other" },
  P: { type: "in_play", description: "In play", kind: "in_play" },
  S: { type: "swinging_strike", description: "Swinging strike", kind: "strike" },
  T: { type: "foul_tip", description: "Foul tip", kind: "strike" },
  V: { type: "automatic_strike", description: "Automatic strike", kind: "strike" },
  X: { type: "in_play", description: "In play", kind: "in_play" },
};

const PITCH_TYPE_META: Record<string, PitchMeta> = {
  automatic_ball: { type: "automatic_ball", description: "Automatic ball", kind: "ball" },
  automatic_strike: {
    type: "automatic_strike",
    description: "Automatic strike",
    kind: "strike",
  },
  ball: { type: "ball", description: "Ball", kind: "ball" },
  ball_in_play: { type: "ball_in_play", description: "In play", kind: "in_play" },
  blocked_ball: { type: "blocked_ball", description: "Ball", kind: "ball" },
  called_strike: { type: "called_strike", description: "Called strike", kind: "strike" },
  foul: { type: "foul", description: "Foul", kind: "foul" },
  foul_bunt: { type: "foul_bunt", description: "Foul bunt", kind: "foul" },
  foul_tip: { type: "foul_tip", description: "Foul tip", kind: "strike" },
  hit_by_pitch: { type: "hit_by_pitch", description: "Hit by pitch", kind: "other" },
  hit_into_play: { type: "hit_into_play", description: "In play", kind: "in_play" },
  in_play: { type: "in_play", description: "In play", kind: "in_play" },
  intent_ball: { type: "intent_ball", description: "Intentional ball", kind: "ball" },
  intent_walk: { type: "intent_walk", description: "Intentional walk", kind: "ball" },
  pitchout: { type: "pitchout", description: "Pitchout", kind: "other" },
  pitch_out: { type: "pitchout", description: "Pitchout", kind: "other" },
  swinging_strike: {
    type: "swinging_strike",
    description: "Swinging strike",
    kind: "strike",
  },
  swinging_strike_blocked: {
    type: "swinging_strike_blocked",
    description: "Swinging strike",
    kind: "strike",
  },
};

function normalizePitchTypeKey(type: string | null | undefined): string {
  return type?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

function isPitchoutType(typeKey: string): boolean {
  return typeKey === "pitchout" || typeKey === "pitch_out";
}

function humanizePitchType(typeKey: string): string | null {
  if (!typeKey || typeKey === "unknown") return null;
  const meta = PITCH_TYPE_META[typeKey];
  if (meta) return meta.description;
  return typeKey
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanPitchDescription(
  description: string,
  typeKey: string,
): string {
  const trimmed = description.trim();
  const fromType = humanizePitchType(typeKey);
  if (!trimmed) return fromType ?? "Pitch";

  const lower = trimmed.toLowerCase();
  if (lower === "pitchout" && !isPitchoutType(typeKey)) {
    return fromType ?? "Pitch";
  }
  if (lower === "unknown" || lower === "?") {
    return fromType ?? "Pitch";
  }
  return trimmed;
}

/** Canonical labels + kinds for official pitch feed rows. */
export function normalizePitchEvent(event: WpblPitchEvent): WpblPitchEvent {
  const code = event.code.trim().toUpperCase();
  const typeKey = normalizePitchTypeKey(event.type);
  const byCode = code ? PITCH_CODE_META[code] : undefined;

  if (byCode) {
    return {
      sequence: event.sequence,
      code,
      type: byCode.type,
      description: byCode.description,
    };
  }

  const byType = PITCH_TYPE_META[typeKey];
  if (byType) {
    return {
      sequence: event.sequence,
      code: code || "?",
      type: byType.type,
      description: byType.description,
    };
  }

  return {
    sequence: event.sequence,
    code: code || "?",
    type: event.type.trim() || "unknown",
    description: cleanPitchDescription(event.description, typeKey),
  };
}

/** Display label for pitch dots / scoreboard copy. */
export function pitchEventLabel(event: WpblPitchEvent): string {
  return normalizePitchEvent(event).description;
}

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
    events.push(
      normalizePitchEvent({
        sequence: i,
        code,
        type: PITCH_CODE_META[code]?.type ?? "unknown",
        description: PITCH_CODE_META[code]?.description ?? "Pitch",
      }),
    );
  }
  return events;
}

export function pitchKind(event: WpblPitchEvent): PitchKind {
  const normalized = normalizePitchEvent(event);
  const fromCode = PITCH_CODE_META[normalized.code]?.kind;
  if (fromCode) return fromCode;

  const typeKey = normalizePitchTypeKey(normalized.type);
  const fromType = PITCH_TYPE_META[typeKey]?.kind;
  if (fromType) return fromType;

  return "other";
}

/** Prefer structured pitch_events; fall back to decoding pitch_sequence. */
export function pitchesFromPlay(play: WpblPlay): WpblPitchEvent[] {
  const raw =
    play.pitchEvents.length > 0
      ? play.pitchEvents
      : decodePitchSequence(play.pitchSequence);
  return raw.map(normalizePitchEvent);
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
  if (playerNamesMatch(batter, latest.batterName)) {
    return { pitches, source: "current", label: "This at-bat" };
  }

  return { pitches, source: "last", label: "Last at-bat" };
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
