/**
 * Airport detail: OurAirports runways (cached) + AviationWeather METAR.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { MAP_DATA_DIR } from "@/lib/fetchers/map_context";

export const RUNWAYS_PATH = path.join(MAP_DATA_DIR, "runways.json");
export const OURAIRPORTS_RUNWAYS_URL =
  "https://davidmegginson.github.io/ourairports-data/runways.csv";

const METAR_URL = "https://aviationweather.gov/api/data/metar";
const FETCH_TIMEOUT_MS = 10_000;
const METAR_CACHE_TTL_MS = 5 * 60_000;

export interface AirportRunway {
  leIdent: string;
  heIdent: string;
  lengthFt: number | null;
  widthFt: number | null;
  surface: string;
  leLat: number;
  leLon: number;
  heLat: number;
  heLon: number;
  leHeadingDeg: number | null;
  heHeadingDeg: number | null;
}

export interface MetarSummary {
  raw: string;
  flightCategory: string | null;
  wind: string | null;
  visibility: string | null;
  ceiling: string | null;
  tempC: number | null;
  observed: string | null;
}

export interface AirportDetail {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  elevFt: number | null;
  runways: AirportRunway[];
  metar: MetarSummary | null;
}

type RunwaysByIcao = Record<string, AirportRunway[]>;

let runwaysCache: RunwaysByIcao | null = null;
const metarCache = new Map<string, { at: number; value: MetarSummary | null }>();

function numOrNull(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  const pushField = () => {
    fields.push(current);
    current = "";
  };

  const pushRecord = () => {
    if (fields.length === 0 || (fields.length === 1 && fields[0] === "")) {
      return;
    }
    records.push([...fields]);
    fields.length = 0;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n" || (char === "\r" && text[i + 1] === "\n")) {
      if (char === "\r") i++;
      pushField();
      pushRecord();
    } else {
      current += char;
    }
  }
  if (current.length > 0 || fields.length > 0) {
    pushField();
    pushRecord();
  }
  return records;
}

export function buildRunwaysFromCsv(csv: string): RunwaysByIcao {
  const records = parseCsvRecords(csv);
  if (records.length < 2) return {};
  const header = records[0].map((h) => h.replace(/^"|"$/g, ""));
  const idx = (name: string) => header.indexOf(name);

  const iIdent = idx("airport_ident");
  const iClosed = idx("closed");
  const iLen = idx("length_ft");
  const iWidth = idx("width_ft");
  const iSurface = idx("surface");
  const iLeIdent = idx("le_ident");
  const iHeIdent = idx("he_ident");
  const iLeLat = idx("le_latitude_deg");
  const iLeLon = idx("le_longitude_deg");
  const iHeLat = idx("he_latitude_deg");
  const iHeLon = idx("he_longitude_deg");
  const iLeHdg = idx("le_heading_degT");
  const iHeHdg = idx("he_heading_degT");

  if (iIdent < 0 || iLeLat < 0 || iHeLat < 0) return {};

  const out: RunwaysByIcao = {};
  for (let r = 1; r < records.length; r++) {
    const row = records[r];
    const icao = (row[iIdent] ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(icao)) continue;
    if (iClosed >= 0 && (row[iClosed] ?? "").trim() === "1") continue;

    const leLat = numOrNull(row[iLeLat]);
    const leLon = numOrNull(row[iLeLon]);
    const heLat = numOrNull(row[iHeLat]);
    const heLon = numOrNull(row[iHeLon]);
    if (leLat == null || leLon == null || heLat == null || heLon == null) {
      continue;
    }

    const runway: AirportRunway = {
      leIdent: (row[iLeIdent] ?? "").trim(),
      heIdent: (row[iHeIdent] ?? "").trim(),
      lengthFt: numOrNull(row[iLen]),
      widthFt: numOrNull(row[iWidth]),
      surface: (row[iSurface] ?? "").trim(),
      leLat,
      leLon,
      heLat,
      heLon,
      leHeadingDeg: numOrNull(row[iLeHdg]),
      heHeadingDeg: numOrNull(row[iHeHdg]),
    };

    if (!out[icao]) out[icao] = [];
    out[icao].push(runway);
  }

  // Longest first per airport
  for (const list of Object.values(out)) {
    list.sort((a, b) => (b.lengthFt ?? 0) - (a.lengthFt ?? 0));
  }
  return out;
}

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status}): ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadRunwaysByIcao(): Promise<RunwaysByIcao> {
  if (runwaysCache) return runwaysCache;

  try {
    const text = await readFile(RUNWAYS_PATH, "utf8");
    runwaysCache = JSON.parse(text) as RunwaysByIcao;
    return runwaysCache;
  } catch {
    // fall through to live CSV (slow cold path)
  }

  try {
    const csv = await fetchWithTimeout(OURAIRPORTS_RUNWAYS_URL);
    runwaysCache = buildRunwaysFromCsv(csv);
    return runwaysCache;
  } catch {
    runwaysCache = {};
    return runwaysCache;
  }
}

export function primaryRunwayHeading(runways: AirportRunway[]): number | null {
  const primary = runways[0];
  if (!primary) return null;
  if (primary.leHeadingDeg != null) return primary.leHeadingDeg;
  // Derive from endpoints
  const dLat = primary.heLat - primary.leLat;
  const dLon = primary.heLon - primary.leLon;
  const deg = (Math.atan2(dLon, dLat) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

function formatWind(wdir: unknown, wspd: unknown, wgst?: unknown): string | null {
  if (typeof wspd !== "number") return null;
  const dir =
    typeof wdir === "number"
      ? String(Math.round(wdir)).padStart(3, "0")
      : "VRB";
  let s = `${dir}@${Math.round(wspd)}`;
  if (typeof wgst === "number" && wgst > wspd) {
    s += `G${Math.round(wgst)}`;
  }
  return `${s}kt`;
}

function formatCeiling(clouds: unknown): string | null {
  if (!Array.isArray(clouds) || clouds.length === 0) return null;
  for (const c of clouds) {
    if (!c || typeof c !== "object") continue;
    const cover = String((c as { cover?: string }).cover ?? "").toUpperCase();
    const base = (c as { base?: number }).base;
    if (
      (cover === "BKN" || cover === "OVC") &&
      typeof base === "number"
    ) {
      return `${cover}${String(Math.round(base / 100)).padStart(3, "0")}`;
    }
  }
  return "SKC";
}

export async function fetchMetar(icao: string): Promise<MetarSummary | null> {
  const code = icao.trim().toUpperCase();
  const cached = metarCache.get(code);
  if (cached && Date.now() - cached.at < METAR_CACHE_TTL_MS) {
    return cached.value;
  }

  const url = `${METAR_URL}?ids=${encodeURIComponent(code)}&format=json`;
  try {
    const text = await fetchWithTimeout(url);
    const data = JSON.parse(text) as unknown;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== "object") {
      metarCache.set(code, { at: Date.now(), value: null });
      return null;
    }
    const m = row as Record<string, unknown>;
    const vis =
      typeof m.visib === "number"
        ? `${m.visib}SM`
        : typeof m.visib === "string"
          ? `${m.visib}SM`
          : null;
    const summary: MetarSummary = {
      raw: typeof m.rawOb === "string" ? m.rawOb : "",
      flightCategory: typeof m.fltCat === "string" ? m.fltCat : null,
      wind: formatWind(m.wdir, m.wspd, m.wgst),
      visibility: vis,
      ceiling: formatCeiling(m.clouds),
      tempC: typeof m.temp === "number" ? m.temp : null,
      observed: typeof m.obsTime === "number"
        ? new Date(m.obsTime * 1000).toISOString()
        : typeof m.reportTime === "string"
          ? m.reportTime
          : null,
    };
    metarCache.set(code, { at: Date.now(), value: summary });
    return summary;
  } catch {
    metarCache.set(code, { at: Date.now(), value: null });
    return null;
  }
}

export async function getAirportDetail(opts: {
  icao: string;
  name?: string;
  lat?: number;
  lon?: number;
  elevFt?: number | null;
}): Promise<AirportDetail> {
  const icao = opts.icao.trim().toUpperCase();
  const byIcao = await loadRunwaysByIcao();
  const runways = byIcao[icao] ?? [];
  const metar = await fetchMetar(icao);

  return {
    icao,
    name: opts.name ?? icao,
    lat: opts.lat ?? runways[0]?.leLat ?? 0,
    lon: opts.lon ?? runways[0]?.leLon ?? 0,
    elevFt: opts.elevFt ?? null,
    runways,
    metar,
  };
}

export function clearAirportDetailCachesForTests(): void {
  runwaysCache = null;
  metarCache.clear();
}
