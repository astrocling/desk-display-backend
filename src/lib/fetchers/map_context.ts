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
export const HIGHWAYS_PATH = path.join(MAP_DATA_DIR, "highways.json");

const FIXTURES_DIR = path.join(MAP_DATA_DIR, "fixtures");
const FIXTURE_AIRPORTS_CSV = path.join(FIXTURES_DIR, "airports.csv");
const FIXTURE_FREQUENCIES_CSV = path.join(
  FIXTURES_DIR,
  "airport-frequencies.csv",
);
const FIXTURE_AIRSPACE_GEOJSON = path.join(FIXTURES_DIR, "airspace.geojson");
const FIXTURE_HIGHWAYS_GEOJSON = path.join(FIXTURES_DIR, "highways.geojson");

export const OURAIRPORTS_AIRPORTS_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
export const OURAIRPORTS_FREQUENCIES_URL =
  "https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv";

/** National Transportation Atlas interstate highways (ArcGIS). */
export const INTERSTATE_HIGHWAYS_URL =
  "https://services.arcgis.com/nUFb6iiYleBwvux5/arcgis/rest/services/US_Data/FeatureServer/4/query?where=1%3D1&outFields=ROUTE_NUM&f=geojson&resultRecordCount=2000";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RING_VERTS = 60;
const MAX_HIGHWAY_VERTS = 80;
const MAX_HIGHWAYS_RESPONSE = 12;

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

export interface HighwayPolyline {
  id: string;
  route: string;
  points: [number, number][];
}

export interface MapContextResponse {
  airports: ToweredAirport[];
  rings: AirspaceRing[];
  highways: HighwayPolyline[];
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

function ringBaseId(
  properties: Record<string, unknown>,
  airspaceClass: "B" | "C" | "D",
  fallbackIndex: number,
): string {
  for (const key of ["identifier", "ident", "IDENT", "id", "ID"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      const base = value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (base && base.length <= 16) {
        return base.endsWith(`_${airspaceClass}`)
          ? base
          : `${base}_${airspaceClass}`;
      }
    }
  }

  return `ring_${fallbackIndex}_${airspaceClass}`;
}

function lonLatRingToLatLon(
  ring: number[][],
): [number, number][] {
  return ring.map((coord) => [coord[1], coord[0]] as [number, number]);
}

/** Exterior rings only — every Polygon / MultiPolygon part (shelf footprint). */
export function exteriorRingsFromGeometry(geometry: {
  type?: string;
  coordinates?: unknown;
}): number[][][] {
  if (!geometry?.type || !geometry.coordinates) {
    return [];
  }

  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates as number[][][];
    return coords[0] && coords[0].length >= 3 ? [coords[0]] : [];
  }

  if (geometry.type === "MultiPolygon") {
    const coords = geometry.coordinates as number[][][][];
    const exteriors: number[][][] = [];
    for (const polygon of coords) {
      const exterior = polygon?.[0];
      if (exterior && exterior.length >= 3) {
        exteriors.push(exterior);
      }
    }
    return exteriors;
  }

  return [];
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
  const shelfCounters = new Map<string, number>();

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
    if (!geometry) {
      return;
    }

    const exteriors = exteriorRingsFromGeometry(geometry);
    const base = ringBaseId(properties, airspaceClass, index);

    for (const exterior of exteriors) {
      const shelfIndex = shelfCounters.get(base) ?? 0;
      shelfCounters.set(base, shelfIndex + 1);

      const latLonPoints = lonLatRingToLatLon(exterior);
      // Drop duplicate closing vertex before simplify when present.
      if (
        latLonPoints.length > 1 &&
        latLonPoints[0][0] === latLonPoints[latLonPoints.length - 1][0] &&
        latLonPoints[0][1] === latLonPoints[latLonPoints.length - 1][1]
      ) {
        latLonPoints.pop();
      }
      if (latLonPoints.length < 3) {
        continue;
      }

      const simplified = simplifyRingToMaxVerts(latLonPoints, MAX_RING_VERTS);
      rings.push({
        class: airspaceClass,
        id: `${base}_${shelfIndex}`,
        points: simplified,
      });
    }
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

export function normalizeInterstateRoute(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) {
    return null;
  }

  // Accept I10, I-10, I10W, etc. — keep letter suffix when present.
  const match = cleaned.match(/^I-?(\d{1,3}[A-Z]?)$/);
  if (!match) {
    return null;
  }
  return `I-${match[1]}`;
}

function lonLatLineToLatLon(line: number[][]): [number, number][] {
  return line.map((coord) => [coord[1], coord[0]] as [number, number]);
}

export function buildHighwaysFromGeoJson(geojson: unknown): HighwayPolyline[] {
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
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  };

  const features =
    doc.type === "FeatureCollection" && Array.isArray(doc.features)
      ? doc.features
      : doc.type === "Feature"
        ? [
            doc as {
              properties?: Record<string, unknown>;
              geometry?: { type?: string; coordinates?: unknown };
            },
          ]
        : [];

  const highways: HighwayPolyline[] = [];
  const routeCounters = new Map<string, number>();

  for (const feature of features) {
    const properties = feature.properties ?? {};
    const routeRaw =
      (typeof properties.ROUTE_NUM === "string" && properties.ROUTE_NUM) ||
      (typeof properties.route === "string" && properties.route) ||
      (typeof properties.id === "string" && properties.id) ||
      "";
    const route = normalizeInterstateRoute(routeRaw);
    if (!route) {
      continue;
    }

    const geometry = feature.geometry;
    if (!geometry?.type || !geometry.coordinates) {
      continue;
    }

    const lines: number[][][] = [];
    if (geometry.type === "LineString") {
      lines.push(geometry.coordinates as number[][]);
    } else if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates as number[][][]) {
        if (line?.length >= 2) {
          lines.push(line);
        }
      }
    }

    for (const line of lines) {
      if (line.length < 2) {
        continue;
      }
      let points = lonLatLineToLatLon(line);
      points = simplifyRingToMaxVerts(points, MAX_HIGHWAY_VERTS);
      if (points.length < 2) {
        continue;
      }
      const part = routeCounters.get(route) ?? 0;
      routeCounters.set(route, part + 1);
      highways.push({
        id: part === 0 ? route : `${route}_${part}`,
        route,
        points,
      });
    }
  }

  return highways;
}

function highwayMinDistanceMi(
  points: [number, number][],
  lat: number,
  lon: number,
): number {
  let min = Infinity;
  for (const [pointLat, pointLon] of points) {
    min = Math.min(min, haversineMiles(lat, lon, pointLat, pointLon));
  }
  return min;
}

export function filterMapContext(
  lat: number,
  lon: number,
  radiusMi: number,
  towered: ToweredAirport[],
  rings: AirspaceRing[],
  highways: HighwayPolyline[] = [],
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

  const filteredHighways = highways
    .map((highway) => ({
      highway,
      distanceMi: highwayMinDistanceMi(highway.points, lat, lon),
    }))
    .filter(
      ({ highway, distanceMi }) =>
        distanceMi <= radiusMi ||
        ringIntersectsRadius(highway.points, lat, lon, radiusMi),
    )
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, MAX_HIGHWAYS_RESPONSE)
    .map(({ highway }) => highway);

  return { airports, rings: filteredRings, highways: filteredHighways };
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
  // Prefer FAA-derived snapshot from @squawk/airspace-data (NASR Class B/C/D).
  try {
    const { gunzipSync } = await import("node:zlib");
    const gzPath = path.join(
      process.cwd(),
      "node_modules",
      "@squawk",
      "airspace-data",
      "data",
      "airspace.geojson.gz",
    );
    const geojsonText = gunzipSync(await readFile(gzPath)).toString("utf8");
    const rings = buildAirspaceRingsFromGeoJson(JSON.parse(geojsonText));
    if (rings.length > 0) {
      return rings;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`@squawk/airspace-data ingest failed (${message})`);
  }

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

export async function buildHighways(): Promise<HighwayPolyline[]> {
  try {
    const geojsonText = await fetchWithTimeout(INTERSTATE_HIGHWAYS_URL);
    const highways = buildHighwaysFromGeoJson(JSON.parse(geojsonText));
    if (highways.length > 0) {
      return highways;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Interstate download failed (${message})`);
  }

  try {
    const geojsonText = await readFixtureText(FIXTURE_HIGHWAYS_GEOJSON);
    return buildHighwaysFromGeoJson(JSON.parse(geojsonText));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Highway fixture ingest failed (${message}); keeping committed ${HIGHWAYS_PATH}`,
    );
    try {
      const existing = await readFile(HIGHWAYS_PATH, "utf8");
      return JSON.parse(existing) as HighwayPolyline[];
    } catch {
      return [];
    }
  }
}

export async function seedMapContextToRedis(): Promise<{
  toweredCount: number;
  ringCount: number;
  highwayCount: number;
}> {
  const [toweredText, ringsText, highwaysText] = await Promise.all([
    readFile(TOWERED_AIRPORTS_PATH, "utf8"),
    readFile(AIRSPACE_RINGS_PATH, "utf8"),
    readFile(HIGHWAYS_PATH, "utf8"),
  ]);

  const towered = JSON.parse(toweredText) as ToweredAirport[];
  const rings = JSON.parse(ringsText) as AirspaceRing[];
  const highways = JSON.parse(highwaysText) as HighwayPolyline[];

  const redis = getRedis();
  await Promise.all([
    redis.set(REDIS_KEYS.mapTowered, towered),
    redis.set(REDIS_KEYS.mapAirspace, rings),
    redis.set(REDIS_KEYS.mapHighways, highways),
  ]);

  // Warm in-process cache for this isolate.
  cachedMapData = { towered, rings, highways };

  return {
    toweredCount: towered.length,
    ringCount: rings.length,
    highwayCount: highways.length,
  };
}

type MapDataBlobs = {
  towered: ToweredAirport[];
  rings: AirspaceRing[];
  highways: HighwayPolyline[];
};

let cachedMapData: MapDataBlobs | null = null;

async function readMapDataFromDisk(): Promise<MapDataBlobs> {
  const [toweredText, ringsText, highwaysText] = await Promise.all([
    readFile(TOWERED_AIRPORTS_PATH, "utf8"),
    readFile(AIRSPACE_RINGS_PATH, "utf8"),
    readFile(HIGHWAYS_PATH, "utf8").catch(() => "[]"),
  ]);
  return {
    towered: JSON.parse(toweredText) as ToweredAirport[],
    rings: JSON.parse(ringsText) as AirspaceRing[],
    highways: JSON.parse(highwaysText) as HighwayPolyline[],
  };
}

async function readMapDataFromRedis(): Promise<MapDataBlobs | null> {
  try {
    const redis = getRedis();
    const [towered, rings, highways] = await Promise.all([
      redis.get<ToweredAirport[]>(REDIS_KEYS.mapTowered),
      redis.get<AirspaceRing[]>(REDIS_KEYS.mapAirspace),
      redis.get<HighwayPolyline[]>(REDIS_KEYS.mapHighways),
    ]);
    if (!Array.isArray(towered) || !Array.isArray(rings)) {
      return null;
    }
    return {
      towered,
      rings,
      highways: Array.isArray(highways) ? highways : [],
    };
  } catch {
    return null;
  }
}

/**
 * Load towered + airspace + highway blobs once per warm isolate.
 * Prefer Redis (after seed); fall back to committed `data/map/*.json`
 * so the route stays cheap and works without a prior seed cron.
 */
export async function loadMapContextData(): Promise<MapDataBlobs> {
  if (cachedMapData) {
    return cachedMapData;
  }

  const fromRedis = await readMapDataFromRedis();
  if (fromRedis) {
    cachedMapData = fromRedis;
    return fromRedis;
  }

  const fromDisk = await readMapDataFromDisk();
  cachedMapData = fromDisk;
  return fromDisk;
}

/** Test helper — clears the in-process cache. */
export function clearMapContextCacheForTests(): void {
  cachedMapData = null;
}
