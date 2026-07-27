/**
 * String builders for the web radar airport selection card.
 * Kept free of MapLibre / React so unit tests stay light.
 */

import type {
  AirportFrequency,
  AirportRunway,
} from "@/components/radar/types";

type MetarInput = {
  raw: string;
  flightCategory: string | null;
  wind: string | null;
  visibility: string | null;
  ceiling: string | null;
  tempC: number | null;
  dewpointC: number | null;
  altimeterInHg: number | null;
  observed: string | null;
} | null;

type TafInput = {
  raw: string;
  validFrom: string | null;
  validTo: string | null;
} | null;

const TAF_MAX_LEN = 120;

function formatMhz(mhz: number): string {
  const s = String(mhz);
  return s.includes(".") ? s.replace(/\.?0+$/, "") || s : s;
}

function formatTempPart(tempC: number | null, dewpointC: number | null): string | null {
  if (tempC != null && dewpointC != null) {
    return `${Math.round(tempC)}/${Math.round(dewpointC)}`;
  }
  if (tempC != null) return String(tempC);
  return null;
}

export function formatAirportSubtitle(opts: {
  municipality: string | null;
  elevFt: number | null;
}): string | null {
  const parts: string[] = [];
  if (opts.municipality?.trim()) parts.push(opts.municipality.trim());
  if (opts.elevFt != null && Number.isFinite(opts.elevFt)) {
    parts.push(`${Math.round(opts.elevFt)} ft`);
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function formatAirportWeatherRows(metar: MetarInput): {
  row1: string[];
  row2: string[];
  raw: string | null;
} {
  if (!metar) return { row1: [], row2: [], raw: null };

  const row1: string[] = [];
  if (metar.flightCategory) row1.push(metar.flightCategory);
  if (metar.wind) row1.push(metar.wind);
  if (metar.visibility) row1.push(metar.visibility);
  if (metar.ceiling) row1.push(metar.ceiling);

  const row2: string[] = [];
  const temp = formatTempPart(metar.tempC, metar.dewpointC);
  if (temp) row2.push(temp);
  if (metar.altimeterInHg != null && Number.isFinite(metar.altimeterInHg)) {
    row2.push(`A${metar.altimeterInHg}`);
  }

  return {
    row1,
    row2,
    raw: metar.raw || null,
  };
}

export function formatAirportTafLine(taf: TafInput): string | null {
  if (!taf?.raw?.trim()) return null;
  const raw = taf.raw.trim();
  if (raw.length <= TAF_MAX_LEN) return raw;
  return `${raw.slice(0, TAF_MAX_LEN - 1)}…`;
}

export function formatAirportRunwayLabel(rwy: AirportRunway): string {
  const idents = [rwy.leIdent, rwy.heIdent].filter(Boolean).join("/");
  const parts: string[] = [idents || "RWY"];

  if (rwy.lengthFt != null && rwy.widthFt != null) {
    parts.push(`${Math.round(rwy.lengthFt)}×${Math.round(rwy.widthFt)}`);
  } else if (rwy.lengthFt != null) {
    parts.push(`${Math.round(rwy.lengthFt)} ft`);
  } else if (rwy.widthFt != null) {
    parts.push(`${Math.round(rwy.widthFt)} ft wide`);
  }

  if (rwy.surface?.trim()) parts.push(rwy.surface.trim());
  if (rwy.lighted) parts.push("lighted");

  return parts.join(" · ");
}

export function formatAirportFreqLine(
  freqs: readonly AirportFrequency[],
): string | null {
  if (!freqs.length) return null;
  const parts = freqs.map((f) => `${f.type} ${formatMhz(f.mhz)}`);
  return parts.join(" · ");
}

export function formatAirportTrafficSummary(opts: {
  inbound: number;
  outbound: number;
}): string | null {
  if (opts.inbound === 0 && opts.outbound === 0) return null;
  const parts: string[] = [];
  if (opts.inbound > 0) parts.push(`Inbound ${opts.inbound}`);
  if (opts.outbound > 0) parts.push(`Outbound ${opts.outbound}`);
  return parts.join(" · ");
}
