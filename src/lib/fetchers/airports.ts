import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";

export const OURAIRPORTS_CSV_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

const BATCH_SIZE = 500;

export interface AirportCoords {
  lat: number;
  lon: number;
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
