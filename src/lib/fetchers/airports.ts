import { readFile } from "node:fs/promises";
import path from "node:path";

import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";

export const OURAIRPORTS_CSV_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

const BATCH_SIZE = 500;

const TOWERED_AIRPORTS_PATH = path.join(
  process.cwd(),
  "data",
  "map",
  "towered-airports.json",
);

export interface AirportCoords {
  lat: number;
  lon: number;
}

type ToweredAirportRow = {
  icao: string;
  lat: number;
  lon: number;
};

let toweredCoordsByIcao: Map<string, AirportCoords> | null = null;

export function parseAirportCoords(value: unknown): AirportCoords | null {
  if (
    value &&
    typeof value === "object" &&
    "lat" in value &&
    "lon" in value &&
    typeof value.lat === "number" &&
    typeof value.lon === "number"
  ) {
    return { lat: value.lat, lon: value.lon };
  }

  if (typeof value === "string") {
    try {
      return parseAirportCoords(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return null;
}

async function loadToweredCoordsIndex(): Promise<Map<string, AirportCoords>> {
  if (toweredCoordsByIcao) {
    return toweredCoordsByIcao;
  }

  const text = await readFile(TOWERED_AIRPORTS_PATH, "utf8");
  const airports = JSON.parse(text) as ToweredAirportRow[];
  const index = new Map<string, AirportCoords>();

  for (const airport of airports) {
    if (
      typeof airport.icao === "string" &&
      Number.isFinite(airport.lat) &&
      Number.isFinite(airport.lon)
    ) {
      index.set(airport.icao.toUpperCase(), {
        lat: airport.lat,
        lon: airport.lon,
      });
    }
  }

  toweredCoordsByIcao = index;
  return index;
}

/** Resolve ICAO → coords via Redis, then committed towered-airport data. */
export async function lookupAirportCoords(
  code: string,
): Promise<AirportCoords | null> {
  const icao = code.trim().toUpperCase();
  if (!icao) {
    return null;
  }

  try {
    const value = await getRedis().hget(REDIS_KEYS.airports, icao);
    const coords = parseAirportCoords(value);
    if (coords) {
      return coords;
    }
  } catch {
    // Redis missing/unavailable — fall through to disk.
  }

  const fromDisk = await loadToweredCoordsIndex();
  return fromDisk.get(icao) ?? null;
}

/** Test helper — clears the in-process towered index cache. */
export function clearAirportLookupCacheForTests(): void {
  toweredCoordsByIcao = null;
}

function looksLikeIcao(code: string): boolean {
  return /^[A-Z]{4}$/i.test(code);
}

function resolveIcao(ident: string, icaoCode: string): string | null {
  if (looksLikeIcao(ident)) {
    return ident.toUpperCase();
  }

  if (icaoCode && looksLikeIcao(icaoCode)) {
    return icaoCode.toUpperCase();
  }

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
      if (char === "\r") {
        i++;
      }
      pushField();
      pushRecord();
    } else if (char !== "\r") {
      current += char;
    }
  }

  if (current || fields.length > 0) {
    pushField();
    pushRecord();
  }

  return records;
}

export function buildAirportMap(
  csvText: string,
): Record<string, AirportCoords> {
  const records = parseCsvRecords(csvText);
  if (records.length === 0) {
    return {};
  }

  const header = records[0].map((column) => column.trim().toLowerCase());
  const identIndex = header.indexOf("ident");
  const icaoIndex = header.indexOf("icao_code");
  const latIndex = header.indexOf("latitude_deg");
  const lonIndex = header.indexOf("longitude_deg");

  if (
    identIndex === -1 ||
    latIndex === -1 ||
    lonIndex === -1
  ) {
    throw new Error("OurAirports CSV missing required columns");
  }

  const map: Record<string, AirportCoords> = {};

  for (const row of records.slice(1)) {
    const ident = row[identIndex]?.trim() ?? "";
    const icaoCode = icaoIndex === -1 ? "" : (row[icaoIndex]?.trim() ?? "");
    const lat = Number(row[latIndex]);
    const lon = Number(row[lonIndex]);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    const icao = resolveIcao(ident, icaoCode);
    if (!icao) {
      continue;
    }

    map[icao] = { lat, lon };
  }

  return map;
}

async function storeAirportMap(
  map: Record<string, AirportCoords>,
): Promise<number> {
  const redis = getRedis();
  const entries = Object.entries(map);

  await redis.del(REDIS_KEYS.airports);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const hashFields: Record<string, string> = {};

    for (const [icao, coords] of batch) {
      hashFields[icao] = JSON.stringify(coords);
    }

    await redis.hset(REDIS_KEYS.airports, hashFields);
  }

  return entries.length;
}

export async function seedAirportsToRedis(): Promise<number> {
  const response = await fetch(OURAIRPORTS_CSV_URL);

  if (!response.ok) {
    throw new Error(`OurAirports download failed: ${response.status}`);
  }

  const csvText = await response.text();
  const map = buildAirportMap(csvText);

  return storeAirportMap(map);
}
