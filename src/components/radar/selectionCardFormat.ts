/**
 * String builders for the web radar selection card (layout C).
 * Kept free of MapLibre / React so unit tests stay light.
 */

import {
  formatRadarAltitude,
  formatRadarSpeed,
  RADAR_BARO_RATE_DEADBAND_FPM,
  radarTrendFromRate,
} from "./radarFormat";
import { labelAircraftType, labelAirline } from "@/lib/radar-expand";

export function formatSelectionRoute(
  routeIcaos: readonly string[] | null | undefined,
): string | null {
  if (!routeIcaos || routeIcaos.length === 0) return null;
  return routeIcaos.join(" → ");
}

export function formatSelectionCities(
  routeIcaos: readonly string[] | null | undefined,
  routeLocations: readonly string[] | null | undefined,
): string | null {
  if (!routeIcaos?.length || !routeLocations?.length) return null;
  if (routeLocations.length !== routeIcaos.length) return null;
  return routeLocations.join(" · ");
}

export function formatSelectionHdg(trackDeg: number | null | undefined): string | null {
  if (trackDeg == null || !Number.isFinite(trackDeg)) return null;
  return `HDG ${Math.round(trackDeg)}`;
}

export function formatSelectionVs(
  baroRateFpm: number | null | undefined,
  onGround?: boolean,
): string | null {
  if (onGround) return null;
  if (baroRateFpm == null || !Number.isFinite(baroRateFpm)) return null;
  if (Math.abs(baroRateFpm) <= RADAR_BARO_RATE_DEADBAND_FPM) return null;
  const rounded = Math.round(baroRateFpm);
  return rounded > 0 ? `+${rounded} fpm` : `${rounded} fpm`;
}

export function formatSelectionTelemetryRow1(opts: {
  altFt: number | null;
  speedKt: number | null;
  baroRateFpm: number | null;
  trackDeg: number | null;
  onGround?: boolean;
}): string[] {
  const parts: string[] = [];
  if (opts.onGround) {
    parts.push("GND");
  } else if (opts.altFt != null) {
    const alt = formatRadarAltitude(opts.altFt, "full");
    const trend = radarTrendFromRate(opts.baroRateFpm);
    if (trend === "climb") parts.push(`${alt} ^`);
    else if (trend === "descend") parts.push(`${alt} v`);
    else parts.push(alt);
  }
  if (opts.speedKt != null) {
    parts.push(formatRadarSpeed(opts.speedKt, "full"));
  }
  const hdg = formatSelectionHdg(opts.trackDeg);
  if (hdg) parts.push(hdg);
  return parts;
}

export function formatSelectionTelemetryRow2(opts: {
  type: string;
  squawk: string;
  baroRateFpm: number | null;
  onGround?: boolean;
}): string[] {
  const parts: string[] = [];
  if (opts.type.trim()) parts.push(opts.type.trim().toUpperCase());
  if (opts.squawk.trim()) parts.push(opts.squawk.trim());
  const vs = formatSelectionVs(opts.baroRateFpm, opts.onGround);
  if (vs) parts.push(vs);
  return parts;
}

export function formatSelectionFooterLeft(opts: {
  airlineCode?: string | null;
  type?: string | null;
}): string | null {
  const airline = labelAirline(opts.airlineCode ?? "");
  const typeLabel = labelAircraftType(opts.type ?? "");
  if (!airline && !typeLabel) return null;
  if (airline && typeLabel) return `${airline} · ${typeLabel}`;
  return airline || typeLabel;
}
