import { readFile } from "node:fs/promises";
import path from "node:path";

import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";

export const MAP_DATA_DIR = path.join(process.cwd(), "data", "map");
export const TOWERED_AIRPORTS_PATH = path.join(
  MAP_DATA_DIR,
  "towered-airports.json",
);
export const AIRSPACE_RINGS_PATH = path.join(MAP_DATA_DIR, "airspace-rings.json");

const FIXTURES_DIR = path.join(MAP_DATA_DIR, "fixtures");
const FIXTURE_AIRPORTS_CSV = path.join(FIXTURES_DIR, "airports.csv");
const FIXTURE_FREQUENCIES_CSV = path.join(
  FIXTURES_DIR,
  "airport-frequencies.csv",
);
const FIXTURE_AIRSPACE_GEOJSON = path.join(FIXTURES_DIR, "airspace.geojson");

export const OURAIRPORTS_AIRPORTS_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
export const OURAIRPORTS_FREQUENCIES_URL =
  "https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RING_VERTS = 60;

export interface ToweredAirport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

export interface AirspaceRing {
  class: "B" | "C" | "D";
  id: string;
  points: [number, number][];
}

export interface MapContextResponse {
  airports: ToweredAirport[];
  rings: AirspaceRing[];
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

export function buildToweredAirportsFromCsv(
  airportsCsv: string,
  frequenciesCsv: string,
): ToweredAirport[] {
  const airportRecords = parseCsvRecords(airportsCsv);
  const frequencyRecords = parseCsvRecords(frequenciesCsv);

  if (airportRecords.length === 0 || frequencyRecords.length === 0) {
    return [];
  }

  const airportHeader = airportRecords[0].map((column) =>
    column.trim().toLowerCase(),
  );
  const airportIdIndex = airportHeader.indexOf("id");
  const identIndex = airportHeader.indexOf("ident");
  const nameIndex = airportHeader.indexOf("name");
  const icaoIndex = airportHeader.indexOf("icao_code");
  const latIndex = airportHeader.indexOf("latitude_deg");
  const lonIndex = airportHeader.indexOf("longitude_deg");

  if (
    airportIdIndex === -1 ||
    identIndex === -1 ||
    nameIndex === -1 ||
    latIndex === -1 ||
    lonIndex === -1
  ) {
    throw new Error("OurAirports airports CSV missing required columns");
  }

  const frequencyHeader = frequencyRecords[0].map((column) =>
    column.trim().toLowerCase(),
  );
  const airportRefIndex = frequencyHeader.indexOf("airport_ref");
  const frequencyTypeIndex = frequencyHeader.indexOf("type");

  if (airportRefIndex === -1 || frequencyTypeIndex === -1) {
    throw new Error("OurAirports frequencies CSV missing required columns");
  }

  const toweredAirportIds = new Set<string>();

  for (const row of frequencyRecords.slice(1)) {
    const type = row[frequencyTypeIndex]?.trim().toUpperCase() ?? "";
    if (!type.includes("TWR")) {
      continue;
    }

    const airportRef = row[airportRefIndex]?.trim();
    if (airportRef) {
      toweredAirportIds.add(airportRef);
    }
  }

  const airports: ToweredAirport[] = [];

  for (const row of airportRecords.slice(1)) {
    const airportId = row[airportIdIndex]?.trim() ?? "";
    if (!toweredAirportIds.has(airportId)) {
      continue;
    }

    const ident = row[identIndex]?.trim() ?? "";
    const icaoCode = icaoIndex === -1 ? "" : (row[icaoIndex]?.trim() ?? "");
    const icao = resolveIcao(ident, icaoCode);
    if (!icao) {
      continue;
    }

    const lat = Number(row[latIndex]);
    const lon = Number(row[lonIndex]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    airports.push({
      icao,
      name: row[nameIndex]?.trim() ?? icao,
      lat,
      lon,
    });
  }

  airports.sort((a, b) => a.icao.localeCompare(b.icao));
  return airports;
}

function perpendicularDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number],
): number {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }

  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(x - projX, y - projY);
}

export function douglasPeucker(
  points: [number, number][],
  epsilon: number,
): [number, number][] {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1],
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
}

export function simplifyRingToMaxVerts(
  points: [number, number][],
  maxVerts: number,
): [number, number][] {
  if (points.length <= maxVerts) {
    return points;
  }

  let epsilon = 0.0001;
  let simplified = points;

  for (let attempt = 0; attempt < 20; attempt++) {
    simplified = douglasPeucker(points, epsilon);
    if (simplified.length <= maxVerts) {
      return simplified;
    }
    epsilon *= 2;
  }

  const step = Math.ceil(points.length / maxVerts);
  const sampled: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  if (sampled.length > maxVerts) {
    return sampled.slice(0, maxVerts);
  }
  return sampled;
}

function normalizeAirspaceClass(value: unknown): "B" | "C" | "D" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "B" || normalized === "CLASS_B" || normalized === "CLASS B") {
    return "B";
  }
  if (normalized === "C" || normalized === "CLASS_C" || normalized === "CLASS C") {
    return "C";
  }
  if (normalized === "D" || normalized === "CLASS_D" || normalized === "CLASS D") {
    return "D";
  }

  return null;
}

function ringIdFromProperties(
  properties: Record<string, unknown>,
  airspaceClass: "B" | "C" | "D",
  fallbackIndex: number,
): string {
  for (const key of ["id", "IDENT", "ident", "identifier", "name", "NAME"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      const base = value.trim().toUpperCase().replace(/\s+/g, "_");
      if (/^[A-Z0-9_]+$/.test(base) && !base.endsWith(`_${airspaceClass}`)) {
        return `${base}_${airspaceClass}`;
      }
      return base;
    }
  }

  return `ring_${fallbackIndex}_${airspaceClass}`;
}

function lonLatRingToLatLon(
  ring: number[][],
): [number, number][] {
  return ring.map((coord) => [coord[1], coord[0]] as [number, number]);
}

export function buildAirspaceRingsFromFeatures(
  features: Array<{
    properties?: Record<string, unknown>;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>,
): AirspaceRing[] {
  const rings: AirspaceRing[] = [];

  features.forEach((feature, index) => {
    const properties = feature.properties ?? {};
    const airspaceClass =
      normalizeAirspaceClass(properties.CLASS) ??
      normalizeAirspaceClass(properties.class) ??
      normalizeAirspaceClass(properties.AIRSPACE_CLASS) ??
      normalizeAirspaceClass(properties.type) ??
      normalizeAirspaceClass(properties.TYPE);

    if (!airspaceClass) {
      return;
    }

    const geometry = feature.geometry;
    if (!geometry?.type || !geometry.coordinates) {
      return;
    }

    let exterior: number[][] | null = null;

    if (geometry.type === "Polygon") {
      const coords = geometry.coordinates as number[][][];
      exterior = coords[0] ?? null;
    } else if (geometry.type === "MultiPolygon") {
      const coords = geometry.coordinates as number[][][][];
      exterior = coords[0]?.[0] ?? null;
    }

    if (!exterior || exterior.length < 3) {
      return;
    }

    const latLonPoints = lonLatRingToLatLon(exterior);
    const simplified = simplifyRingToMaxVerts(latLonPoints, MAX_RING_VERTS);

    rings.push({
      class: airspaceClass,
      id: ringIdFromProperties(properties, airspaceClass, index),
      points: simplified,
    });
  });

  return rings;
}

export function buildAirspaceRingsFromGeoJson(geojson: unknown): AirspaceRing[] {
  let root: unknown = geojson;
  if (typeof geojson === "string") {
    try {
      root = JSON.parse(geojson);
    } catch {
      return [];
    }
  }

  if (!root || typeof root !== "object") {
    return [];
  }

  const doc = root as {
    type?: string;
    features?: Array<{
      properties?: Record<string, unknown>;
      geometry?: {
        type?: string;
        coordinates?: unknown;
      };
    }>;
  };

  if (doc.type === "FeatureCollection" && Array.isArray(doc.features)) {
    return buildAirspaceRingsFromFeatures(doc.features);
  }

  if (doc.type === "Feature") {
    return buildAirspaceRingsFromFeatures([
      doc as {
        properties?: Record<string, unknown>;
        geometry?: { type?: string; coordinates?: unknown };
      },
    ]);
  }

  return [];
}

const EARTH_RADIUS_MI = 3958.8;

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a));
}

function ringCentroid(points: [number, number][]): [number, number] {
  let latSum = 0;
  let lonSum = 0;
  for (const [lat, lon] of points) {
    latSum += lat;
    lonSum += lon;
  }
  return [latSum / points.length, lonSum / points.length];
}

function ringBbox(points: [number, number][]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const [lat, lon] of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  return { minLat, maxLat, minLon, maxLon };
}

function bboxIntersectsCircle(
  bbox: ReturnType<typeof ringBbox>,
  lat: number,
  lon: number,
  radiusMi: number,
): boolean {
  const latMiPerDeg = 69.0;
  const lonMiPerDeg = 69.0 * Math.cos((lat * Math.PI) / 180);
  const radiusLat = radiusMi / latMiPerDeg;
  const radiusLon = radiusMi / lonMiPerDeg;

  const circleMinLat = lat - radiusLat;
  const circleMaxLat = lat + radiusLat;
  const circleMinLon = lon - radiusLon;
  const circleMaxLon = lon + radiusLon;

  return !(
    bbox.maxLat < circleMinLat ||
    bbox.minLat > circleMaxLat ||
    bbox.maxLon < circleMinLon ||
    bbox.minLon > circleMaxLon
  );
}

function ringIntersectsRadius(
  points: [number, number][],
  lat: number,
  lon: number,
  radiusMi: number,
): boolean {
  if (!bboxIntersectsCircle(ringBbox(points), lat, lon, radiusMi)) {
    return false;
  }

  for (const [pointLat, pointLon] of points) {
    if (haversineMiles(lat, lon, pointLat, pointLon) <= radiusMi) {
      return true;
    }
  }

  const [centroidLat, centroidLon] = ringCentroid(points);
  return haversineMiles(lat, lon, centroidLat, centroidLon) <= radiusMi;
}

export function filterMapContext(
  lat: number,
  lon: number,
  radiusMi: number,
  towered: ToweredAirport[],
  rings: AirspaceRing[],
): MapContextResponse {
  const airports = towered
    .map((airport) => ({
      airport,
      distanceMi: haversineMiles(lat, lon, airport.lat, airport.lon),
    }))
    .filter(({ distanceMi }) => distanceMi <= radiusMi)
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .map(({ airport }) => airport);

  const filteredRings = rings.filter((ring) =>
    ringIntersectsRadius(ring.points, lat, lon, radiusMi),
  );

  return { airports, rings: filteredRings };
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

async function readFixtureText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function buildToweredAirports(): Promise<ToweredAirport[]> {
  try {
    const [airportsCsv, frequenciesCsv] = await Promise.all([
      fetchWithTimeout(OURAIRPORTS_AIRPORTS_URL),
      fetchWithTimeout(OURAIRPORTS_FREQUENCIES_URL),
    ]);
    return buildToweredAirportsFromCsv(airportsCsv, frequenciesCsv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `OurAirports download failed (${message}); using fixture CSVs from ${FIXTURES_DIR}`,
    );

    const [airportsCsv, frequenciesCsv] = await Promise.all([
      readFixtureText(FIXTURE_AIRPORTS_CSV),
      readFixtureText(FIXTURE_FREQUENCIES_CSV),
    ]);

    return buildToweredAirportsFromCsv(airportsCsv, frequenciesCsv);
  }
}

export async function buildAirspaceRings(): Promise<AirspaceRing[]> {
  try {
    const geojsonText = await readFixtureText(FIXTURE_AIRSPACE_GEOJSON);
    return buildAirspaceRingsFromGeoJson(JSON.parse(geojsonText));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Airspace fixture ingest failed (${message}); keeping committed ${AIRSPACE_RINGS_PATH}`,
    );
    const existing = await readFile(AIRSPACE_RINGS_PATH, "utf8");
    return JSON.parse(existing) as AirspaceRing[];
  }
}

export async function seedMapContextToRedis(): Promise<{
  toweredCount: number;
  ringCount: number;
}> {
  const [toweredText, ringsText] = await Promise.all([
    readFile(TOWERED_AIRPORTS_PATH, "utf8"),
    readFile(AIRSPACE_RINGS_PATH, "utf8"),
  ]);

  const towered = JSON.parse(toweredText) as ToweredAirport[];
  const rings = JSON.parse(ringsText) as AirspaceRing[];

  const redis = getRedis();
  await Promise.all([
    redis.set(REDIS_KEYS.mapTowered, towered),
    redis.set(REDIS_KEYS.mapAirspace, rings),
  ]);

  return { toweredCount: towered.length, ringCount: rings.length };
}
