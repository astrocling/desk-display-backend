import type {
  WpblLiveSituation,
  WpblPitchEvent,
  WpblPlay,
  WpblTrackingEvent,
} from "@/lib/types/wpbl-display";
import { playerNamesMatch } from "@/lib/wpbl-player-match";

import {
  atBatPitchLog,
  latestWpblPlay,
  pitchKind,
  pitchesFromPlay,
  type AtBatPitchLog,
} from "@/lib/wpbl-plays";

const PITCH_TYPE_ABBR: Record<string, string> = {
  fastball: "FB",
  fourseamfastball: "FF",
  four_seam_fastball: "FF",
  twoseamfastball: "FT",
  sinker: "SI",
  cutter: "FC",
  slider: "SL",
  curveball: "CU",
  changeup: "CH",
  splitter: "FS",
  knuckleball: "KN",
  undefined: "?",
};

/** Short pitch-type label for chips (FB, SL, …). */
export function pitchTypeAbbr(pitchType: string | null | undefined): string | null {
  const raw = pitchType?.trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s-]+/g, "");
  if (PITCH_TYPE_ABBR[key]) return PITCH_TYPE_ABBR[key];
  const spaced = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (PITCH_TYPE_ABBR[spaced]) return PITCH_TYPE_ABBR[spaced];
  return raw.slice(0, 2).toUpperCase();
}

export function roundSpeed(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

/** Chronological TrackMan rows for one plate appearance. */
export function trackingForPlateAppearance(
  tracking: WpblTrackingEvent[],
  opts: {
    batterName: string | null | undefined;
    inning: number | null | undefined;
    half: "top" | "bottom" | null | undefined;
  },
): WpblTrackingEvent[] {
  if (!opts.batterName?.trim()) return [];
  return tracking
    .filter((row) => {
      if (!playerNamesMatch(row.batterName, opts.batterName)) return false;
      if (
        opts.inning != null &&
        row.inning != null &&
        row.inning !== opts.inning
      ) {
        return false;
      }
      if (opts.half && row.half && row.half !== opts.half) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.occurredAt ?? "") || 0;
      const tb = Date.parse(b.occurredAt ?? "") || 0;
      if (ta !== tb) return ta - tb;
      return (a.sequence ?? 0) - (b.sequence ?? 0);
    });
}

export type PitchChipKind =
  | "ball"
  | "strike"
  | "foul"
  | "in_play"
  | "other"
  | "track";

export type PitchChip = {
  key: string;
  /** Primary glyph: B/K/S/F/X or pitch-type abbr when result unknown. */
  label: string;
  kind: PitchChipKind;
  pitchTypeAbbr: string | null;
  releaseMph: number | null;
  exitMph: number | null;
  title: string;
};

function resultLabel(event: WpblPitchEvent): string {
  const kind = pitchKind(event);
  if (kind === "ball") return "B";
  if (kind === "foul") return "F";
  if (kind === "in_play") return "X";
  if (kind === "strike") {
    if (event.type.includes("swinging") || event.code.toUpperCase() === "S") {
      return "S";
    }
    return "K";
  }
  return event.code || "?";
}

/** Play-feed-only chips (no TrackMan), for callers without play context. */
export function chipsFromPitchEvents(events: WpblPitchEvent[]): PitchChip[] {
  return zipPitchEventsWithTracking(events, []);
}

function chipTitle(
  result: string | null,
  track: WpblTrackingEvent | null,
): string {
  const bits: string[] = [];
  if (result) bits.push(result);
  if (track?.pitchType) bits.push(track.pitchType);
  const release = roundSpeed(track?.releaseSpeed);
  if (release != null) {
    bits.push(`${release} ${track?.speedUnit ?? "mph"}`);
  }
  const exit = roundSpeed(track?.exitSpeed);
  if (exit != null) {
    bits.push(`${exit} exit`);
  }
  if (track?.spinRateRpm != null && Number.isFinite(track.spinRateRpm)) {
    bits.push(`${Math.round(track.spinRateRpm)} rpm`);
  }
  return bits.join(" · ") || "Pitch";
}

/**
 * Zip official pitch results with TrackMan rows for one plate appearance.
 * Pitch-kind rows align by order; contact/exit attaches to the final in-play pitch.
 */
export function zipPitchEventsWithTracking(
  events: WpblPitchEvent[],
  paTracking: WpblTrackingEvent[],
): PitchChip[] {
  if (!events.length) return [];

  const pitchTracks = paTracking.filter((r) => r.kind === "pitch");
  const hit =
    paTracking.find((r) => r.kind === "hit") ??
    paTracking.find((r) => r.exitSpeed != null) ??
    null;
  // Prefer pitch-only rows; fall back to chronological PA if TrackMan omitted kind.
  const trackRows =
    pitchTracks.length > 0
      ? pitchTracks
      : paTracking.filter((r) => r.kind !== "hit");

  return events.map((event, i) => {
    let track: WpblTrackingEvent | null = trackRows[i] ?? null;
    const kind = pitchKind(event);
    if (kind === "in_play" && hit && i === events.length - 1) {
      track = track
        ? {
            ...track,
            exitSpeed: track.exitSpeed ?? hit.exitSpeed,
            hitType: track.hitType ?? hit.hitType,
            launchAngleDeg: track.launchAngleDeg ?? hit.launchAngleDeg,
            distance: track.distance ?? hit.distance,
            distanceUnit: track.distanceUnit ?? hit.distanceUnit,
          }
        : hit;
    }
    return {
      key: `${event.sequence}-${event.code}-${i}`,
      label: resultLabel(event),
      kind,
      pitchTypeAbbr: pitchTypeAbbr(track?.pitchType),
      releaseMph: roundSpeed(track?.releaseSpeed),
      exitMph: roundSpeed(track?.exitSpeed),
      title: chipTitle(event.description || event.type, track),
    };
  });
}

/** Enrich one completed play’s pitch chips with TrackMan for that PA. */
export function chipsForPlay(
  play: WpblPlay,
  tracking: WpblTrackingEvent[],
): PitchChip[] {
  const events = pitchesFromPlay(play);
  if (!events.length) return [];
  const pa = trackingForPlateAppearance(tracking, {
    batterName: play.batterName,
    inning: play.inning,
    half: play.half,
  });
  return zipPitchEventsWithTracking(events, pa);
}

/**
 * Build scoreboard pitch chips: play-feed results enriched with TrackMan,
 * or TrackMan-only chips mid-PA when the free play feed has not finished the AB.
 */
export function buildPitchChips(
  situation: WpblLiveSituation | null,
  plays: WpblPlay[],
  tracking: WpblTrackingEvent[],
): { chips: PitchChip[]; label: string | null; source: AtBatPitchLog["source"] } {
  const playLog = atBatPitchLog(situation, plays);
  const liveBatter = situation?.batterName ?? null;
  const liveInning = situation?.inningNumber ?? null;
  const liveHalf = situation?.half ?? null;

  const liveTracking = trackingForPlateAppearance(tracking, {
    batterName: liveBatter,
    inning: liveInning,
    half: liveHalf,
  });

  // Mid-PA: TrackMan can publish pitches before the official PA ends.
  if (
    liveTracking.length > 0 &&
    (!playLog.pitches.length || playLog.source === "last")
  ) {
    const chips = liveTracking.map((row, i) => {
      const abbr = pitchTypeAbbr(row.pitchType);
      const mph = roundSpeed(row.releaseSpeed);
      const exit = roundSpeed(row.exitSpeed);
      const label =
        row.kind === "hit" && exit != null
          ? `${exit}`
          : abbr && mph != null
            ? `${abbr}`
            : abbr ?? (mph != null ? `${mph}` : "P");
      return {
        key: row.activityId || `track-${i}`,
        label,
        kind: (row.kind === "hit" ? "in_play" : "track") as PitchChipKind,
        pitchTypeAbbr: abbr,
        releaseMph: mph,
        exitMph: exit,
        title: chipTitle(null, row),
      };
    });
    return { chips, label: "This at-bat", source: "current" };
  }

  if (!playLog.pitches.length) {
    return { chips: [], label: null, source: null };
  }

  const latestPlay = latestWpblPlay(plays);
  const trackRows =
    playLog.source === "current"
      ? liveTracking
      : trackingForPlateAppearance(tracking, {
          batterName: latestPlay?.batterName,
          inning: latestPlay?.inning,
          half: latestPlay?.half,
        });

  return {
    chips: zipPitchEventsWithTracking(playLog.pitches, trackRows),
    label: playLog.label,
    source: playLog.source,
  };
}

/** Latest TrackMan row overall (for a one-line “last pitch” callout). */
export function latestTrackingEvent(
  tracking: WpblTrackingEvent[],
): WpblTrackingEvent | null {
  if (!tracking.length) return null;
  return tracking.reduce((best, row) => {
    const tb = Date.parse(row.occurredAt ?? "") || 0;
    const ta = Date.parse(best.occurredAt ?? "") || 0;
    if (tb > ta) return row;
    if (tb === ta && (row.sequence ?? 0) >= (best.sequence ?? 0)) return row;
    return best;
  });
}

/** Newest-first for the TrackMan feed. */
export function sortTrackingNewestFirst(
  tracking: WpblTrackingEvent[],
): WpblTrackingEvent[] {
  return [...tracking].sort((a, b) => {
    const tb = Date.parse(b.occurredAt ?? "") || 0;
    const ta = Date.parse(a.occurredAt ?? "") || 0;
    if (tb !== ta) return tb - ta;
    return (b.sequence ?? 0) - (a.sequence ?? 0);
  });
}

export type TrackingFeedMode = "all" | "pitches" | "hits";

export function filterTrackingFeed(
  tracking: WpblTrackingEvent[],
  mode: TrackingFeedMode,
): WpblTrackingEvent[] {
  const sorted = sortTrackingNewestFirst(tracking);
  if (mode === "pitches") return sorted.filter((r) => r.kind === "pitch");
  if (mode === "hits") return sorted.filter((r) => r.kind === "hit");
  return sorted;
}

/** TrackMan often sends "Last, First" — flip for display. */
export function displayTrackingName(
  name: string | null | undefined,
): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (!trimmed.includes(",")) return trimmed;
  const [last, ...rest] = trimmed.split(",");
  const first = rest.join(",").trim();
  if (!first) return last?.trim() || null;
  return `${first} ${last?.trim()}`.trim();
}

/** Title-case snake/camel labels (ChangeUp → Change Up). */
export function humanizeTrackingLabel(
  value: string | null | undefined,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTrackingInning(event: WpblTrackingEvent): string {
  if (event.half === "top" && event.inning != null) return `Top ${event.inning}`;
  if (event.half === "bottom" && event.inning != null) {
    return `Bot ${event.inning}`;
  }
  if (event.inning != null) return `Inn ${event.inning}`;
  return event.kind === "hit" ? "Hit" : "Pitch";
}

export type TrackingMetricChip = {
  text: string;
  /** Emphasize exit velo / impact metrics. */
  impact?: boolean;
};

/** Metric chips for a TrackMan feed row (type, release, spin, exit, …). */
export function trackingMetricChips(
  event: WpblTrackingEvent,
): TrackingMetricChip[] {
  const chips: TrackingMetricChip[] = [];
  const type = humanizeTrackingLabel(event.pitchType);
  if (type) chips.push({ text: type });

  const unit = event.speedUnit?.trim() || "mph";
  const release = roundSpeed(event.releaseSpeed);
  if (release != null) chips.push({ text: `${release} ${unit}` });

  if (event.spinRateRpm != null && Number.isFinite(event.spinRateRpm)) {
    chips.push({ text: `${Math.round(event.spinRateRpm)} rpm` });
  }

  const exit = roundSpeed(event.exitSpeed);
  if (exit != null) {
    chips.push({ text: `${exit} ${unit} exit`, impact: true });
  }

  if (event.launchAngleDeg != null && Number.isFinite(event.launchAngleDeg)) {
    const angle = Math.round(event.launchAngleDeg * 10) / 10;
    chips.push({ text: `${angle}° launch` });
  }

  const hit = humanizeTrackingLabel(event.hitType);
  if (hit) chips.push({ text: hit });

  if (
    event.distance != null &&
    Number.isFinite(event.distance) &&
    event.distance >= 1
  ) {
    const dist = Math.round(event.distance);
    const dUnit = event.distanceUnit?.trim() || "ft";
    chips.push({ text: `${dist} ${dUnit}` });
  }

  const zone = humanizeTrackingLabel(event.strikeZoneDecision);
  if (zone) {
    chips.push({ text: `Zone: ${zone}` });
  } else {
    const call = plateLocationCall(event);
    if (call === "in") chips.push({ text: "In zone" });
    else if (call === "out") chips.push({ text: "Out of zone" });
  }

  return chips;
}

/**
 * Typical rulebook plate half-width (~8.5") and a mid-height zone window in feet.
 * Catcher's view: +side = catcher's right.
 */
export const STRIKE_ZONE = {
  sideMin: -0.83,
  sideMax: 0.83,
  heightMin: 1.5,
  heightMax: 3.5,
} as const;

/** Plot window (feet) for the SVG zone chart. */
export const STRIKE_ZONE_VIEW = {
  sideMin: -2.2,
  sideMax: 2.2,
  heightMin: 0.2,
  heightMax: 4.8,
} as const;

export type PlateLocationCall = "in" | "out" | null;

export function hasPlateLocation(event: WpblTrackingEvent): boolean {
  return (
    event.plateLocationHeight != null &&
    Number.isFinite(event.plateLocationHeight) &&
    event.plateLocationSide != null &&
    Number.isFinite(event.plateLocationSide)
  );
}

/** Geometric in/out vs a fixed rulebook-ish zone (not umpire call). */
export function plateLocationCall(
  event: WpblTrackingEvent,
): PlateLocationCall {
  if (!hasPlateLocation(event)) return null;
  const side = event.plateLocationSide!;
  const height = event.plateLocationHeight!;
  const inSide = side >= STRIKE_ZONE.sideMin && side <= STRIKE_ZONE.sideMax;
  const inHeight =
    height >= STRIKE_ZONE.heightMin && height <= STRIKE_ZONE.heightMax;
  return inSide && inHeight ? "in" : "out";
}

export type StrikeZonePoint = {
  key: string;
  side: number;
  height: number;
  inZone: boolean;
  label: string;
  /** 0 = oldest among plotted, 1 = newest */
  recency: number;
};

/** Newest-first pitches with plate location for the zone chart. */
export function strikeZonePoints(
  tracking: WpblTrackingEvent[],
  limit = 40,
): StrikeZonePoint[] {
  const withLoc = sortTrackingNewestFirst(tracking).filter(
    (e) => e.kind === "pitch" && hasPlateLocation(e),
  );
  const sliced = withLoc.slice(0, Math.max(0, limit));
  const n = sliced.length;
  return sliced.map((event, i) => {
    const abbr = pitchTypeAbbr(event.pitchType) ?? "P";
    const mph = roundSpeed(event.releaseSpeed);
    const call = plateLocationCall(event);
    return {
      key: event.activityId,
      side: event.plateLocationSide!,
      height: event.plateLocationHeight!,
      inZone: call === "in",
      label:
        mph != null
          ? `${abbr} ${mph} · ${call === "in" ? "in" : "out"}`
          : `${abbr} · ${call === "in" ? "in" : "out"}`,
      recency: n <= 1 ? 1 : 1 - i / (n - 1),
    };
  });
}

export function formatTrackingClock(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
