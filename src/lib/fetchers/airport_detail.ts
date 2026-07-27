/**
 * Airport detail: OurAirports runways (cached) + AviationWeather METAR.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  MAP_DATA_DIR,
  OURAIRPORTS_AIRPORTS_URL,
  OURAIRPORTS_FREQUENCIES_URL,
} from "@/lib/fetchers/map_context";

export const RUNWAYS_PATH = path.join(MAP_DATA_DIR, "runways.json");
export const OURAIRPORTS_RUNWAYS_URL =
  "https://davidmegginson.github.io/ourairports-data/runways.csv";

export const AIRPORT_IDENTITY_PATH = path.join(
  MAP_DATA_DIR,
  "airport-identity.json",
);
export const FREQUENCIES_PATH = path.join(MAP_DATA_DIR, "frequencies.json");

const FIXTURES_DIR = path.join(MAP_DATA_DIR, "fixtures");
const FIXTURE_AIRPORTS_CSV = path.join(FIXTURES_DIR, "airports.csv");
const FIXTURE_FREQUENCIES_CSV = path.join(
  FIXTURES_DIR,
  "airport-frequencies.csv",
);

const METAR_URL = "https://aviationweather.gov/api/data/metar";
const TAF_URL = "https://aviationweather.gov/api/data/taf";
const FETCH_TIMEOUT_MS = 10_000;
const METAR_CACHE_TTL_MS = 5 * 60_000;
const TAF_CACHE_TTL_MS = 10 * 60_000;

const OPERATIONAL_FREQUENCY_ORDER = [
  "ATIS",
  "TWR",
  "GND",
  "GROUND",
  "APP",
  "DEP",
  "CTAF",
  "UNICOM",
];

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
  lighted: boolean | null;
}

export interface AirportIdentity {
  icao: string;
  iata: string;
  name: string;
  municipality: string;
  elevFt: number | null;
  lat: number;
  lon: number;
}

export interface AirportFrequency {
  type: string;
  description: string;
  mhz: number;
}

export interface MetarSummary {
  raw: string;
  flightCategory: string | null;
  wind: string | null;
  visibility: string | null;
  ceiling: string | null;
  tempC: number | null;
  dewpointC: number | null;
  altimeterInHg: number | null;
  observed: string | null;
}

export interface TafSummary {
  raw: string;
  validFrom: string | null;
  validTo: string | null;
}

export interface AirportDetail {
  icao: string;
  iata: string | null;
  name: string;
  municipality: string | null;
  elevFt: number | null;
  lat: number;
  lon: number;
  runways: AirportRunway[];
  frequencies: AirportFrequency[];
  metar: MetarSummary | null;
  taf: TafSummary | null;
}

type RunwaysByIcao = Record<string, AirportRunway[]>;
type IdentityByIcao = Record<string, AirportIdentity>;
type FrequenciesByIcao = Record<string, AirportFrequency[]>;

let runwaysCache: RunwaysByIcao | null = null;
let identityCache: IdentityByIcao | null = null;
let frequenciesCache: FrequenciesByIcao | null = null;
let airportsAndFrequenciesCsvPromise: Promise<{
  airportsCsv: string;
  frequenciesCsv: string;
  source: "live" | "fixture";
}> | null = null;
const metarCache = new Map<string, { at: number; value: MetarSummary | null }>();
const tafCache = new Map<string, { at: number; value: TafSummary | null }>();

function numOrNull(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(v: string | undefined): boolean | null {
  const trimmed = (v ?? "").trim();
  if (trimmed === "1") return true;
  if (trimmed === "0") return false;
  return null;
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
  const iLighted = idx("lighted");
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
      lighted: boolOrNull(row[iLighted]),
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

function icaoFromIdentAndCode(
  ident: string | undefined,
  icaoCode: string | undefined,
): string | null {
  const upperIdent = (ident ?? "").trim().toUpperCase();
  if (/^[A-Z]{4}$/.test(upperIdent)) return upperIdent;
  const upperCode = (icaoCode ?? "").trim().toUpperCase();
  if (/^[A-Z]{4}$/.test(upperCode)) return upperCode;
  return null;
}

export function buildAirportIdentityFromCsv(csv: string): IdentityByIcao {
  const records = parseCsvRecords(csv);
  if (records.length < 2) return {};
  const header = records[0].map((h) => h.replace(/^"|"$/g, ""));
  const idx = (name: string) => header.indexOf(name);

  const iIdent = idx("ident");
  const iIcaoCode = idx("icao_code");
  const iIata = idx("iata_code");
  const iName = idx("name");
  const iMunicipality = idx("municipality");
  const iElev = idx("elevation_ft");
  const iLat = idx("latitude_deg");
  const iLon = idx("longitude_deg");

  if (iIdent < 0 || iLat < 0 || iLon < 0) return {};

  const out: IdentityByIcao = {};
  for (let r = 1; r < records.length; r++) {
    const row = records[r];
    const icao = icaoFromIdentAndCode(
      row[iIdent],
      iIcaoCode >= 0 ? row[iIcaoCode] : undefined,
    );
    if (!icao) continue;

    const lat = numOrNull(row[iLat]);
    const lon = numOrNull(row[iLon]);
    if (lat == null || lon == null) continue;

    out[icao] = {
      icao,
      iata: iIata >= 0 ? (row[iIata] ?? "").trim() : "",
      name: iName >= 0 ? (row[iName] ?? "").trim() : icao,
      municipality: iMunicipality >= 0 ? (row[iMunicipality] ?? "").trim() : "",
      elevFt: iElev >= 0 ? numOrNull(row[iElev]) : null,
      lat,
      lon,
    };
  }
  return out;
}

export function buildFrequenciesFromCsv(
  airportsCsv: string,
  frequenciesCsv: string,
): FrequenciesByIcao {
  const airportRecords = parseCsvRecords(airportsCsv);
  const freqRecords = parseCsvRecords(frequenciesCsv);
  if (airportRecords.length < 2 || freqRecords.length < 2) return {};

  const airportHeader = airportRecords[0].map((h) => h.replace(/^"|"$/g, ""));
  const aIdx = (name: string) => airportHeader.indexOf(name);
  const iId = aIdx("id");
  const iIdent = aIdx("ident");
  const iIcaoCode = aIdx("icao_code");
  if (iId < 0 || iIdent < 0) return {};

  const icaoById = new Map<string, string>();
  for (let r = 1; r < airportRecords.length; r++) {
    const row = airportRecords[r];
    const id = (row[iId] ?? "").trim();
    if (!id) continue;
    const icao = icaoFromIdentAndCode(
      row[iIdent],
      iIcaoCode >= 0 ? row[iIcaoCode] : undefined,
    );
    if (icao) icaoById.set(id, icao);
  }

  const freqHeader = freqRecords[0].map((h) => h.replace(/^"|"$/g, ""));
  const fIdx = (name: string) => freqHeader.indexOf(name);
  const iRef = fIdx("airport_ref");
  const iType = fIdx("type");
  const iDesc = fIdx("description");
  const iMhz = fIdx("frequency_mhz");
  if (iRef < 0 || iType < 0 || iMhz < 0) return {};

  const out: FrequenciesByIcao = {};
  for (let r = 1; r < freqRecords.length; r++) {
    const row = freqRecords[r];
    const icao = icaoById.get((row[iRef] ?? "").trim());
    if (!icao) continue;

    const mhz = numOrNull(row[iMhz]);
    if (mhz == null) continue;

    const freq: AirportFrequency = {
      type: (row[iType] ?? "").trim().toUpperCase(),
      description: iDesc >= 0 ? (row[iDesc] ?? "").trim() : "",
      mhz,
    };

    if (!out[icao]) out[icao] = [];
    out[icao].push(freq);
  }
  return out;
}

function operationalRank(type: string): number {
  const upper = type.toUpperCase();
  for (let i = 0; i < OPERATIONAL_FREQUENCY_ORDER.length; i++) {
    if (upper.includes(OPERATIONAL_FREQUENCY_ORDER[i])) return i;
  }
  return -1;
}

/** Keeps only operational frequency types, sorted ATIS -> TWR -> GND -> APP -> DEP -> CTAF -> UNICOM -> other. */
export function filterOperationalFrequencies(
  freqs: AirportFrequency[],
): AirportFrequency[] {
  return freqs
    .map((freq) => ({ freq, rank: operationalRank(freq.type) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.freq);
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

type CsvSource = "live" | "fixture";

/**
 * Fetches the OurAirports CSVs, falling back to the committed fixture
 * CSVs (with a loud warning, matching map_context's pattern) when the live
 * download fails. Fixture data is a last resort for a handful of sample
 * airports — never treat it as authoritative, and never invent frequencies
 * that aren't in one of these sources.
 */
async function fetchAirportsAndFrequenciesCsv(): Promise<{
  airportsCsv: string;
  frequenciesCsv: string;
  source: CsvSource;
}> {
  try {
    const [airportsCsv, frequenciesCsv] = await Promise.all([
      fetchWithTimeout(OURAIRPORTS_AIRPORTS_URL),
      fetchWithTimeout(OURAIRPORTS_FREQUENCIES_URL),
    ]);
    return { airportsCsv, frequenciesCsv, source: "live" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `OurAirports live download failed (${message}); falling back to sample fixture CSVs from ${FIXTURES_DIR}. ` +
        "Identity/frequency data will be incomplete until a retry succeeds.",
    );
    const [airportsCsv, frequenciesCsv] = await Promise.all([
      readFile(FIXTURE_AIRPORTS_CSV, "utf8"),
      readFile(FIXTURE_FREQUENCIES_CSV, "utf8"),
    ]);
    return { airportsCsv, frequenciesCsv, source: "fixture" };
  }
}

/**
 * Memoizes the in-flight CSV fetch so identity + frequencies loaders
 * (run concurrently from getAirportDetail) don't each trigger their own
 * network round-trip on a cold cache. Deliberately does NOT keep a
 * fixture-sourced result memoized: fixture data is only a handful of
 * sample airports, so pinning it for the rest of the process lifetime
 * would silently serve wrong/missing data forever. Leaving the memo null
 * lets the next call retry the live download.
 */
function loadAirportsAndFrequenciesCsv(): Promise<{
  airportsCsv: string;
  frequenciesCsv: string;
  source: CsvSource;
}> {
  if (!airportsAndFrequenciesCsvPromise) {
    airportsAndFrequenciesCsvPromise = fetchAirportsAndFrequenciesCsv()
      .then((result) => {
        if (result.source === "fixture") {
          airportsAndFrequenciesCsvPromise = null;
        }
        return result;
      })
      .catch((error: unknown) => {
        airportsAndFrequenciesCsvPromise = null;
        throw error;
      });
  }
  return airportsAndFrequenciesCsvPromise;
}

export async function loadAirportIdentityByIcao(): Promise<IdentityByIcao> {
  if (identityCache) return identityCache;

  try {
    const text = await readFile(AIRPORT_IDENTITY_PATH, "utf8");
    identityCache = JSON.parse(text) as IdentityByIcao;
    return identityCache;
  } catch {
    // fall through to live/fixture CSV (slow cold path)
  }

  try {
    const { airportsCsv, source } = await loadAirportsAndFrequenciesCsv();
    const identity = buildAirportIdentityFromCsv(airportsCsv);
    // Only pin a live-sourced result; a fixture result should be retried.
    if (source === "live") identityCache = identity;
    return identity;
  } catch {
    return {};
  }
}

export async function loadFrequenciesByIcao(): Promise<FrequenciesByIcao> {
  if (frequenciesCache) return frequenciesCache;

  try {
    const text = await readFile(FREQUENCIES_PATH, "utf8");
    frequenciesCache = JSON.parse(text) as FrequenciesByIcao;
    return frequenciesCache;
  } catch {
    // fall through to live/fixture CSV (slow cold path)
  }

  try {
    const { airportsCsv, frequenciesCsv, source } =
      await loadAirportsAndFrequenciesCsv();
    const frequencies = buildFrequenciesFromCsv(airportsCsv, frequenciesCsv);
    // Only pin a live-sourced result; a fixture result should be retried.
    if (source === "live") frequenciesCache = frequencies;
    return frequencies;
  } catch {
    return {};
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

/** Attach longest-runway true headings for radar airport glyphs. */
export function attachPrimaryRunwayHeadings<
  T extends { icao: string; primaryRunwayHeadingDeg?: number | null },
>(airports: T[], runwaysByIcao: RunwaysByIcao): T[] {
  return airports.map((airport) => {
    const heading = primaryRunwayHeading(runwaysByIcao[airport.icao] ?? []);
    if (heading == null && airport.primaryRunwayHeadingDeg == null) {
      return airport;
    }
    return {
      ...airport,
      primaryRunwayHeadingDeg: heading,
    };
  });
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

/** Converts a METAR altimeter reading from hectopascals to inches of mercury. */
export function hPaToInHg(hPa: number): number {
  return Math.round((hPa / 33.8639) * 100) / 100;
}

export function parseTafRow(row: unknown): TafSummary | null {
  if (!row || typeof row !== "object") return null;
  const t = row as Record<string, unknown>;
  const raw = typeof t.rawTAF === "string" ? t.rawTAF : "";
  if (!raw) return null;
  return {
    raw,
    validFrom:
      typeof t.validTimeFrom === "number"
        ? new Date(t.validTimeFrom * 1000).toISOString()
        : null,
    validTo:
      typeof t.validTimeTo === "number"
        ? new Date(t.validTimeTo * 1000).toISOString()
        : null,
  };
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
      dewpointC: typeof m.dewp === "number" ? m.dewp : null,
      altimeterInHg: typeof m.altim === "number" ? hPaToInHg(m.altim) : null,
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

export async function fetchTaf(icao: string): Promise<TafSummary | null> {
  const code = icao.trim().toUpperCase();
  const cached = tafCache.get(code);
  if (cached && Date.now() - cached.at < TAF_CACHE_TTL_MS) {
    return cached.value;
  }

  const url = `${TAF_URL}?ids=${encodeURIComponent(code)}&format=json`;
  try {
    const text = await fetchWithTimeout(url);
    const data = JSON.parse(text) as unknown;
    const row = Array.isArray(data) ? data[0] : null;
    const summary = parseTafRow(row);
    tafCache.set(code, { at: Date.now(), value: summary });
    return summary;
  } catch {
    tafCache.set(code, { at: Date.now(), value: null });
    return null;
  }
}

/**
 * Pure assembly of an already-loaded airport's pieces into the response
 * shape. Never invents iata/municipality/elev — omits (null) when the
 * identity lookup doesn't have them, falling back to caller-supplied
 * hints (e.g. from the towered-airports map context) only for
 * name/lat/lon/elevFt.
 */
export function assembleAirportDetail(input: {
  icao: string;
  identity: AirportIdentity | null;
  runways: AirportRunway[];
  frequencies: AirportFrequency[];
  metar: MetarSummary | null;
  taf: TafSummary | null;
  fallback?: {
    name?: string;
    lat?: number;
    lon?: number;
    elevFt?: number | null;
  };
}): AirportDetail {
  const icao = input.icao.trim().toUpperCase();
  const { identity, runways, frequencies, metar, taf } = input;
  const fallback = input.fallback ?? {};

  return {
    icao,
    iata: identity?.iata ? identity.iata : null,
    name: identity?.name || fallback.name || icao,
    municipality: identity?.municipality ? identity.municipality : null,
    elevFt: identity?.elevFt ?? fallback.elevFt ?? null,
    lat: identity?.lat ?? fallback.lat ?? runways[0]?.leLat ?? 0,
    lon: identity?.lon ?? fallback.lon ?? runways[0]?.leLon ?? 0,
    runways,
    frequencies,
    metar,
    taf,
  };
}

export async function getAirportDetail(opts: {
  icao: string;
  name?: string;
  lat?: number;
  lon?: number;
  elevFt?: number | null;
}): Promise<AirportDetail> {
  const icao = opts.icao.trim().toUpperCase();
  const [runwaysByIcao, identityByIcao, frequenciesByIcao] =
    await Promise.all([
      loadRunwaysByIcao(),
      loadAirportIdentityByIcao(),
      loadFrequenciesByIcao(),
    ]);
  const runways = runwaysByIcao[icao] ?? [];
  const identity = identityByIcao[icao] ?? null;
  const frequencies = filterOperationalFrequencies(
    frequenciesByIcao[icao] ?? [],
  );

  const [metar, taf] = await Promise.all([fetchMetar(icao), fetchTaf(icao)]);

  return assembleAirportDetail({
    icao,
    identity,
    runways,
    frequencies,
    metar,
    taf,
    fallback: {
      name: opts.name,
      lat: opts.lat,
      lon: opts.lon,
      elevFt: opts.elevFt,
    },
  });
}

export function clearAirportDetailCachesForTests(): void {
  runwaysCache = null;
  identityCache = null;
  frequenciesCache = null;
  airportsAndFrequenciesCsvPromise = null;
  metarCache.clear();
  tafCache.clear();
}
