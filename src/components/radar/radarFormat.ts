/** Port of desk_display radar_format — ATC-lite tag strings. */

import type { WatchlistColor, WatchlistEntry } from "@/lib/radar-watchlist";

export type { WatchlistColor, WatchlistEntry };

export const RADAR_FLIGHT_LEVEL_MIN_FT = 18000;
export const RADAR_BARO_RATE_DEADBAND_FPM = 100;
/** Device shows vectors/tags at ≤25 mi range (web declutter ignores this). */
export const RADAR_VECTOR_MAX_RANGE_MI = 25;

export const RADAR_DECLUTTER_STORAGE_KEY = "desk-display.radar.declutter";
export const RADAR_DECLUTTER_DEFAULT: RadarDeclutterMode = "tag";

export type RadarDeclutterMode = "target" | "callsign" | "tag";
export type RadarUnselectedLabel = "none" | "callsign" | "dense";

export type RadarTrend = "none" | "climb" | "descend";
export type RadarTagStyle = "full" | "dense";
export type AircraftNotable = "none" | "emergency" | "military" | "interesting";

export const COLORS = {
  bg: "#0B0F14",
  accent: "#3D9CF0",
  dim: "#6B7280",
  alert: "#E85D4C",
  military: "#C4A35A",
  aircraft: "#00FF00",
  selected: "#FFFFFF",
  airport: "#FFFFFF",
  airspaceB: "#3A6AA8",
  airspaceC: "#A83A7A",
  airspaceD: "#3A6AA8",
  highway: "#2A323C",
  runway: "#C8D0D8",
  tfr: "#E85D4C",
  ground: "#3D6B3D",
  scopeRing: "#1A4A1A",
  watchlistGreen: "#3DCF8E",
  watchlistViolet: "#A78BFA",
} as const;

const WATCHLIST_COLOR_HEX: Record<WatchlistColor, string> = {
  default: COLORS.accent,
  amber: COLORS.military,
  alert: COLORS.alert,
  green: COLORS.watchlistGreen,
  violet: COLORS.watchlistViolet,
};

export function watchlistColorHex(color?: WatchlistColor): string {
  if (!color || color === "default") return COLORS.accent;
  return WATCHLIST_COLOR_HEX[color] ?? COLORS.accent;
}

export type RadarDisplayMode = "map" | "scope";
export const RADAR_MODE_STORAGE_KEY = "desk-display.radar.mode";
export const RADAR_MODE_DEFAULT: RadarDisplayMode = "map";

export function parseRadarDisplayMode(raw: unknown): RadarDisplayMode {
  if (raw === "map" || raw === "scope") return raw;
  return RADAR_MODE_DEFAULT;
}

export function parseRadarDeclutterMode(raw: unknown): RadarDeclutterMode {
  if (raw === "target" || raw === "callsign" || raw === "tag") {
    return raw;
  }
  return RADAR_DECLUTTER_DEFAULT;
}

export function radarUnselectedLabel(
  mode: RadarDeclutterMode,
): RadarUnselectedLabel {
  switch (mode) {
    case "target":
      return "none";
    case "callsign":
      return "callsign";
    case "tag":
    default:
      return "dense";
  }
}

export function radarDeclutterShortLabel(mode: RadarDeclutterMode): string {
  switch (mode) {
    case "target":
      return "Target";
    case "callsign":
      return "Callsign";
    case "tag":
    default:
      return "Tag";
  }
}

export function radarTrendFromRate(
  baroRateFpm: number | null,
): RadarTrend {
  if (baroRateFpm == null || !Number.isFinite(baroRateFpm)) {
    return "none";
  }
  if (baroRateFpm > RADAR_BARO_RATE_DEADBAND_FPM) return "climb";
  if (baroRateFpm < -RADAR_BARO_RATE_DEADBAND_FPM) return "descend";
  return "none";
}

export function formatRadarAltitude(altFt: number, style: RadarTagStyle): string {
  const hundreds = Math.round(altFt / 100);
  if (style === "dense") {
    return String(hundreds).padStart(3, "0");
  }
  const prefix = altFt >= RADAR_FLIGHT_LEVEL_MIN_FT ? "F" : "A";
  return `${prefix}${String(hundreds).padStart(3, "0")}`;
}

export function formatRadarSpeed(speedKt: number, style: RadarTagStyle): string {
  const knots = Math.round(speedKt);
  if (style === "dense") {
    return String(knots).padStart(3, "0");
  }
  return `G${String(knots).padStart(3, "0")}`;
}

export function formatRadarTagLine2(opts: {
  altFt: number | null;
  speedKt: number | null;
  baroRateFpm: number | null;
  style: RadarTagStyle;
}): string {
  const parts: string[] = [];
  if (opts.altFt != null) {
    parts.push(formatRadarAltitude(opts.altFt, opts.style));
  }
  const trend = radarTrendFromRate(opts.baroRateFpm);
  if (trend === "climb") parts.push("^");
  if (trend === "descend") parts.push("v");
  if (opts.speedKt != null) {
    parts.push(formatRadarSpeed(opts.speedKt, opts.style));
  }
  return parts.join(" ");
}

export function notableReason(notable: AircraftNotable): string | null {
  switch (notable) {
    case "emergency":
      return "EMRG";
    case "military":
      return "MIL";
    case "interesting":
      return "INTR";
    default:
      return null;
  }
}

export function formatRadarTagLine3(opts: {
  type: string;
  squawk: string;
  notable: AircraftNotable;
  arrivalIcao?: string | null;
}): string {
  const parts: string[] = [];
  if (opts.type) parts.push(opts.type);
  const arrival = opts.arrivalIcao?.trim().toUpperCase();
  if (arrival) parts.push(arrival);
  if (opts.squawk) parts.push(opts.squawk);
  const reason = notableReason(opts.notable);
  if (reason) parts.push(reason);
  return parts.join(" ");
}

const DB_FLAG_MILITARY = 1;
const DB_FLAG_INTERESTING = 2;

function matchesInterestingReg(
  registration: string,
  callsign: string,
  interestingRegs: readonly string[] | undefined,
): boolean {
  if (!interestingRegs || interestingRegs.length === 0) return false;
  const reg = registration.trim().toUpperCase();
  const cs = callsign.trim().toUpperCase();
  for (const id of interestingRegs) {
    const needle = id.trim().toUpperCase();
    if (reg && reg === needle) return true;
    if (cs && cs === needle) return true;
  }
  return false;
}

export function findWatchlistEntry(
  registration: string,
  callsign: string,
  entries: readonly WatchlistEntry[] | undefined,
): WatchlistEntry | undefined {
  if (!entries || entries.length === 0) return undefined;
  const reg = registration.trim().toUpperCase();
  const cs = callsign.trim().toUpperCase();
  for (const entry of entries) {
    const id = entry.id.trim().toUpperCase();
    if (reg && reg === id) return entry;
    if (cs && cs === id) return entry;
  }
  return undefined;
}

export function classifyNotable(opts: {
  squawk: string;
  emergency: string;
  dbFlags: number;
  registration?: string;
  callsign?: string;
  interestingRegs?: readonly string[];
  interestingEntries?: readonly WatchlistEntry[];
}): AircraftNotable {
  if (
    opts.squawk === "7500" ||
    opts.squawk === "7600" ||
    opts.squawk === "7700" ||
    (opts.emergency !== "" && opts.emergency !== "none")
  ) {
    return "emergency";
  }
  if ((opts.dbFlags & DB_FLAG_MILITARY) !== 0) {
    return "military";
  }
  const registration = opts.registration ?? "";
  const callsign = opts.callsign ?? "";
  const onWatchlist = opts.interestingEntries
    ? findWatchlistEntry(registration, callsign, opts.interestingEntries) !=
      null
    : matchesInterestingReg(registration, callsign, opts.interestingRegs);
  if ((opts.dbFlags & DB_FLAG_INTERESTING) !== 0 || onWatchlist) {
    return "interesting";
  }
  return "none";
}

/** Mark color matching device radar_lvgl notable → color. */
export function markColorFor(
  notable: AircraftNotable,
  selected: boolean,
  watchlistColor?: WatchlistColor,
): string {
  if (selected) return COLORS.selected;
  switch (notable) {
    case "emergency":
      return COLORS.alert;
    case "military":
      return COLORS.military;
    case "interesting":
      return watchlistColorHex(watchlistColor);
    default:
      return COLORS.aircraft;
  }
}

/** Line-1 label with optional 2s callsign/note rotation. */
export function tagLine1Display(
  callsign: string,
  note: string | undefined,
  phase: 0 | 1,
): string {
  const trimmedNote = note?.trim() ?? "";
  if (
    !trimmedNote ||
    trimmedNote.toUpperCase() === callsign.trim().toUpperCase()
  ) {
    return callsign;
  }
  return phase === 1 ? trimmedNote : callsign;
}

/** Velocity vector length in px — device: clamp(gs * 0.04, 8, 28). */
export function vectorLengthPx(speedKt: number | null): number {
  if (speedKt == null || !Number.isFinite(speedKt)) return 16;
  return Math.min(28, Math.max(8, speedKt * 0.04));
}
