/** Port of desk_display radar_format — ATC-lite tag strings. */

export const RADAR_FLIGHT_LEVEL_MIN_FT = 18000;
export const RADAR_BARO_RATE_DEADBAND_FPM = 100;
/** Device shows vectors/tags at ≤25 mi range. */
export const RADAR_VECTOR_MAX_RANGE_MI = 25;

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
} as const;

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
}): string {
  const parts: string[] = [];
  if (opts.type) parts.push(opts.type);
  if (opts.squawk) parts.push(opts.squawk);
  const reason = notableReason(opts.notable);
  if (reason) parts.push(reason);
  return parts.join(" ");
}

const DB_FLAG_MILITARY = 1;
const DB_FLAG_INTERESTING = 2;

export function classifyNotable(opts: {
  squawk: string;
  emergency: string;
  dbFlags: number;
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
  if ((opts.dbFlags & DB_FLAG_INTERESTING) !== 0) {
    return "interesting";
  }
  return "none";
}

/** Mark color matching device radar_lvgl notable → color. */
export function markColorFor(
  notable: AircraftNotable,
  selected: boolean,
): string {
  if (selected) return COLORS.selected;
  switch (notable) {
    case "emergency":
      return COLORS.alert;
    case "military":
      return COLORS.military;
    case "interesting":
      return COLORS.accent;
    default:
      return COLORS.aircraft;
  }
}

/** Velocity vector length in px — device: clamp(gs * 0.04, 8, 28). */
export function vectorLengthPx(speedKt: number | null): number {
  if (speedKt == null || !Number.isFinite(speedKt)) return 16;
  return Math.min(28, Math.max(8, speedKt * 0.04));
}
