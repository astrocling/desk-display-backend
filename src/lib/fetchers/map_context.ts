import { readFile } from "node:fs/promises";
import path from "node:path";

import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";

export const MAP_DATA_DIR = path.join(process.cwd(), "data", "map");
export const TOWERED_AIRPORTS_PATH = path.join(
  MAP_DATA_DIR,
  "towered-airports.json",
);
export const AIRPORTS_CATALOG_PATH = path.join(
  MAP_DATA_DIR,
  "airports-catalog.json",
);
export const AIRPORT_DESIGNATORS_PATH = path.join(
  MAP_DATA_DIR,
  "airport-designators.json",
);
export const ARTCC_BOUNDARIES_PATH = path.join(
  MAP_DATA_DIR,
  "artcc-boundaries.json",
);
export const APP_DEP_BOUNDARIES_PATH = path.join(
  MAP_DATA_DIR,
  "app-dep-boundaries.json",
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
const FIXTURE_ARTCC_GEOJSON = path.join(FIXTURES_DIR, "artcc.geojson");
const FIXTURE_APP_DEP_GEOJSON = path.join(FIXTURES_DIR, "app-dep.geojson");
const FIXTURE_HIGHWAYS_GEOJSON = path.join(FIXTURES_DIR, "highways.geojson");
const FIXTURE_RUNWAYS_CSV = path.join(FIXTURES_DIR, "runways.csv");

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

export interface MapAirport {
  icao: string;
  ident: string;
  name: string;
  lat: number;
  lon: number;
  towered: boolean;
  publicUse: boolean;
  pavedRunwayFt: number | null;
  /** Longest runway true heading (degrees) for glyph orientation. */
  primaryRunwayHeadingDeg?: number | null;
}

/** @deprecated Use MapAirport — alias kept to reduce call-site churn. */
export type ToweredAirport = MapAirport;

export interface FacilityBoundary {
  id: string;
  name: string;
  kind: "artcc" | "app_dep";
  points: [number, number][];
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
  airports: MapAirport[];
  rings: AirspaceRing[];
  highways: HighwayPolyline[];
  artcc: FacilityBoundary[];
  appDep: FacilityBoundary[];
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

function resolveCatalogIcao(ident: string, icaoCode: string): string {
  return resolveIcao(ident, icaoCode) ?? ident.trim().toUpperCase();
}

const PUBLIC_AIRPORT_TYPES = new Set([
  "large_airport",
  "medium_airport",
  "small_airport",
  "heliport",
]);

const PAVED_SURFACE_RE = /asp|con|pem|bit|tar|concrete|asphalt/i;

function isPublicAirportType(type: string): boolean {
  return PUBLIC_AIRPORT_TYPES.has(type.trim().toLowerCase());
}

type RunwaySummary = {
  lengthFt: number | null;
  surface: string;
};

function buildRunwaysByAirportRefFromCsv(
  runwaysCsv: string,
): Map<string, RunwaySummary[]> {
  const records = parseCsvRecords(runwaysCsv);
  if (records.length === 0) {
    return new Map();
  }

  const header = records[0].map((column) => column.trim().toLowerCase());
  const airportRefIndex = header.indexOf("airport_ref");
  const lengthIndex = header.indexOf("length_ft");
  const surfaceIndex = header.indexOf("surface");
  const closedIndex = header.indexOf("closed");

  if (airportRefIndex === -1) {
    return new Map();
  }

  const byRef = new Map<string, RunwaySummary[]>();

  for (const row of records.slice(1)) {
    const airportRef = row[airportRefIndex]?.trim() ?? "";
    if (!airportRef) {
      continue;
    }
    if (closedIndex !== -1 && row[closedIndex]?.trim() === "1") {
      continue;
    }

    const lengthRaw = lengthIndex === -1 ? "" : (row[lengthIndex]?.trim() ?? "");
    const lengthFt = lengthRaw === "" ? null : Number(lengthRaw);
    const runway: RunwaySummary = {
      lengthFt: Number.isFinite(lengthFt) ? lengthFt : null,
      surface: surfaceIndex === -1 ? "" : (row[surfaceIndex]?.trim() ?? ""),
    };

    const existing = byRef.get(airportRef) ?? [];
    existing.push(runway);
    byRef.set(airportRef, existing);
  }

  return byRef;
}

function maxPavedRunwayFt(runways: RunwaySummary[] | undefined): number | null {
  if (!runways?.length) {
    return null;
  }

  let max: number | null = null;
  for (const runway of runways) {
    if (!PAVED_SURFACE_RE.test(runway.surface)) {
      continue;
    }
    if (runway.lengthFt == null) {
      continue;
    }
    max = max == null ? runway.lengthFt : Math.max(max, runway.lengthFt);
  }
  return max;
}

function buildToweredAirportIdSet(frequenciesCsv: string): Set<string> {
  const frequencyRecords = parseCsvRecords(frequenciesCsv);
  if (frequencyRecords.length === 0) {
    return new Set();
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

  return toweredAirportIds;
}

function parseAirportCsvHeader(airportsCsv: string): {
  records: string[][];
  airportIdIndex: number;
  identIndex: number;
  nameIndex: number;
  typeIndex: number;
  icaoIndex: number;
  localCodeIndex: number;
  latIndex: number;
  lonIndex: number;
} {
  const airportRecords = parseCsvRecords(airportsCsv);
  if (airportRecords.length === 0) {
    throw new Error("OurAirports airports CSV missing required columns");
  }

  const airportHeader = airportRecords[0].map((column) =>
    column.trim().toLowerCase(),
  );
  const airportIdIndex = airportHeader.indexOf("id");
  const identIndex = airportHeader.indexOf("ident");
  const nameIndex = airportHeader.indexOf("name");
  const typeIndex = airportHeader.indexOf("type");
  const icaoIndex = airportHeader.indexOf("icao_code");
  const localCodeIndex = airportHeader.indexOf("local_code");
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

  return {
    records: airportRecords,
    airportIdIndex,
    identIndex,
    nameIndex,
    typeIndex,
    icaoIndex,
    localCodeIndex,
    latIndex,
    lonIndex,
  };
}

export function buildAirportCatalogFromCsv(
  airportsCsv: string,
  frequenciesCsv: string,
  runwaysInput: string | Map<string, RunwaySummary[]>,
): MapAirport[] {
  const {
    records: airportRecords,
    airportIdIndex,
    identIndex,
    nameIndex,
    typeIndex,
    icaoIndex,
    latIndex,
    lonIndex,
  } = parseAirportCsvHeader(airportsCsv);

  const toweredAirportIds = buildToweredAirportIdSet(frequenciesCsv);
  const runwaysByAirportRef =
    typeof runwaysInput === "string"
      ? buildRunwaysByAirportRefFromCsv(runwaysInput)
      : runwaysInput;

  const airports: MapAirport[] = [];

  for (const row of airportRecords.slice(1)) {
    const airportId = row[airportIdIndex]?.trim() ?? "";
    const ident = row[identIndex]?.trim() ?? "";
    if (!ident) {
      continue;
    }

    const icaoCode = icaoIndex === -1 ? "" : (row[icaoIndex]?.trim() ?? "");
    const icao = resolveCatalogIcao(ident, icaoCode);

    const lat = Number(row[latIndex]);
    const lon = Number(row[lonIndex]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    const type = typeIndex === -1 ? "" : (row[typeIndex]?.trim() ?? "");

    airports.push({
      icao,
      ident,
      name: row[nameIndex]?.trim() ?? icao,
      lat,
      lon,
      towered: toweredAirportIds.has(airportId),
      publicUse: isPublicAirportType(type),
      pavedRunwayFt: maxPavedRunwayFt(runwaysByAirportRef.get(airportId)),
    });
  }

  airports.sort((a, b) => a.ident.localeCompare(b.ident));
  return airports;
}

export function buildLocalCodesByIdentFromCsv(
  airportsCsv: string,
): Record<string, string> {
  const { records, identIndex, localCodeIndex } = parseAirportCsvHeader(airportsCsv);
  const localCodesByIdent: Record<string, string> = {};

  if (localCodeIndex === -1) {
    return localCodesByIdent;
  }

  for (const row of records.slice(1)) {
    const ident = row[identIndex]?.trim() ?? "";
    const localCode = row[localCodeIndex]?.trim() ?? "";
    if (ident && localCode) {
      localCodesByIdent[ident] = localCode;
    }
  }

  return localCodesByIdent;
}

export function buildDesignatorIndex(
  airports: MapAirport[],
  localCodesByIdent: Record<string, string> = {},
): Record<string, string> {
  const index: Record<string, string> = {};

  for (const airport of airports) {
    const ident = airport.ident.trim();
    if (!ident) {
      continue;
    }

    index[ident.toUpperCase()] = ident;

    const icao = airport.icao.trim().toUpperCase();
    if (icao) {
      index[icao] = ident;
    }

    const localCode = localCodesByIdent[ident]?.trim().toUpperCase();
    if (localCode) {
      index[localCode] = ident;
    }
  }

  return index;
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
): MapAirport[] {
  const {
    records: airportRecords,
    airportIdIndex,
    identIndex,
    nameIndex,
    typeIndex,
    icaoIndex,
    latIndex,
    lonIndex,
  } = parseAirportCsvHeader(airportsCsv);
  const toweredAirportIds = buildToweredAirportIdSet(frequenciesCsv);

  const airports: MapAirport[] = [];

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

    const type = typeIndex === -1 ? "" : (row[typeIndex]?.trim() ?? "");

    airports.push({
      icao,
      ident,
      name: row[nameIndex]?.trim() ?? icao,
      lat,
      lon,
      towered: true,
      publicUse: isPublicAirportType(type),
      pavedRunwayFt: null,
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

function douglasPeucker(
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

function simplifyRing(
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
  fallbackIndex: number,
): string {
  for (const key of ["id", "IDENT", "ident", "name", "NAME"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return `ring_${fallbackIndex}`;
}

function lonLatRingToLatLon(ring: number[][]): [number, number][] {
  return ring.map((coord) => [coord[1], coord[0]] as [number, number]);
}

function facilityProperty(
  properties: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function buildFacilityBoundariesFromGeoJson(
  geojson: unknown,
  kind: FacilityBoundary["kind"],
): FacilityBoundary[] {
  if (!geojson || typeof geojson !== "object") {
    return [];
  }

  const root = geojson as {
    type?: string;
    features?: Array<{
      properties?: Record<string, unknown>;
      geometry?: {
        type?: string;
        coordinates?: unknown;
      };
    }>;
  };

  const features =
    root.type === "FeatureCollection" && Array.isArray(root.features)
      ? root.features
      : root.type === "Feature"
        ? [
            root as {
              properties?: Record<string, unknown>;
              geometry?: { type?: string; coordinates?: unknown };
            },
          ]
        : [];

  const boundaries: FacilityBoundary[] = [];

  features.forEach((feature, index) => {
    const properties = feature.properties ?? {};
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

    const id =
      facilityProperty(properties, ["id", "ID"]) || `${kind}_${index}`;
    const name =
      facilityProperty(properties, ["name", "NAME"]) || id;
    const latLonPoints = lonLatRingToLatLon(exterior);
    const simplified = simplifyRing(latLonPoints, MAX_RING_VERTS);

    boundaries.push({
      id,
      name,
      kind,
      points: simplified,
    });
  });

  return boundaries;
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
      normalizeAirspaceClass(properties.AIRSPACE_CLASS);

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
    const simplified = simplifyRing(latLonPoints, MAX_RING_VERTS);

    rings.push({
      class: airspaceClass,
      id: ringIdFromProperties(properties, index),
      points: simplified,
    });
  });

  return rings;
}

export function buildAirspaceRingsFromGeoJson(geojson: unknown): AirspaceRing[] {
  if (!geojson || typeof geojson !== "object") {
    return [];
  }

  const root = geojson as {
    type?: string;
    features?: Array<{
      properties?: Record<string, unknown>;
      geometry?: {
        type?: string;
        coordinates?: unknown;
      };
    }>;
  };

  if (root.type === "FeatureCollection" && Array.isArray(root.features)) {
    return buildAirspaceRingsFromFeatures(root.features);
  }

  if (root.type === "Feature") {
    return buildAirspaceRingsFromFeatures([
      root as {
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
      points = simplifyRing(points, MAX_HIGHWAY_VERTS);
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
  airportsInput: MapAirport[],
  rings: AirspaceRing[],
  highways: HighwayPolyline[] = [],
  artcc: FacilityBoundary[] = [],
  appDep: FacilityBoundary[] = [],
  opts: { toweredOnly?: boolean } = {},
): MapContextResponse {
  const airports = airportsInput
    .map((airport) => ({
      airport,
      distanceMi: haversineMiles(lat, lon, airport.lat, airport.lon),
    }))
    .filter(({ distanceMi }) => distanceMi <= radiusMi)
    .filter(({ airport }) => (opts.toweredOnly ? airport.towered : true))
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .map(({ airport }) => airport);

  const filteredRings = rings.filter((ring) =>
    ringIntersectsRadius(ring.points, lat, lon, radiusMi),
  );

  const filteredArtcc = artcc.filter((boundary) =>
    ringIntersectsRadius(boundary.points, lat, lon, radiusMi),
  );

  const filteredAppDep = appDep.filter((boundary) =>
    ringIntersectsRadius(boundary.points, lat, lon, radiusMi),
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

  return {
    airports,
    rings: filteredRings,
    highways: filteredHighways,
    artcc: filteredArtcc,
    appDep: filteredAppDep,
  };
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

async function readOptionalJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Fetches the OurAirports airports + frequencies CSVs, falling back to the
 * committed fixture CSVs (with a loud warning) when the live download
 * fails. Shared by tower detection and by the airport identity/frequency
 * builders so the build script only pays for one round-trip.
 */
export const OURAIRPORTS_RUNWAYS_URL =
  "https://davidmegginson.github.io/ourairports-data/runways.csv";

export async function fetchOurAirportsRunwaysCsv(): Promise<string> {
  try {
    return await fetchWithTimeout(OURAIRPORTS_RUNWAYS_URL);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `OurAirports runways download failed (${message}); using fixture CSV from ${FIXTURE_RUNWAYS_CSV}`,
    );
    return readFixtureText(FIXTURE_RUNWAYS_CSV);
  }
}

export async function fetchOurAirportsCsvs(): Promise<{
  airportsCsv: string;
  frequenciesCsv: string;
}> {
  try {
    const [airportsCsv, frequenciesCsv] = await Promise.all([
      fetchWithTimeout(OURAIRPORTS_AIRPORTS_URL),
      fetchWithTimeout(OURAIRPORTS_FREQUENCIES_URL),
    ]);
    return { airportsCsv, frequenciesCsv };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `OurAirports download failed (${message}); using fixture CSVs from ${FIXTURES_DIR}`,
    );

    const [airportsCsv, frequenciesCsv] = await Promise.all([
      readFixtureText(FIXTURE_AIRPORTS_CSV),
      readFixtureText(FIXTURE_FREQUENCIES_CSV),
    ]);

    return { airportsCsv, frequenciesCsv };
  }
}

export async function buildToweredAirports(): Promise<MapAirport[]> {
  const { airportsCsv, frequenciesCsv } = await fetchOurAirportsCsvs();
  return buildToweredAirportsFromCsv(airportsCsv, frequenciesCsv);
}

export async function buildAirspaceRings(): Promise<AirspaceRing[]> {
  // Prefer previously baked national rings. fixtures/airspace.geojson is only a
  // tiny Dayton sample for unit tests — regenerating from it must not clobber
  // the NASR-derived airspace-rings.json (see commit 4edae70).
  try {
    const existingText = await readFile(AIRSPACE_RINGS_PATH, "utf8");
    const existing = JSON.parse(existingText) as AirspaceRing[];
    if (Array.isArray(existing) && existing.length > 100) {
      return existing;
    }
  } catch {
    // fall through to fixture ingest
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

async function buildFacilityBoundariesFromFixture(
  fixturePath: string,
  outputPath: string,
  kind: FacilityBoundary["kind"],
): Promise<FacilityBoundary[]> {
  try {
    const geojsonText = await readFixtureText(fixturePath);
    return buildFacilityBoundariesFromGeoJson(JSON.parse(geojsonText), kind);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `${kind} fixture ingest failed (${message}); keeping committed ${outputPath}`,
    );
    return readOptionalJsonFile<FacilityBoundary[]>(outputPath, []);
  }
}

export async function buildArtccBoundaries(): Promise<FacilityBoundary[]> {
  return buildFacilityBoundariesFromFixture(
    FIXTURE_ARTCC_GEOJSON,
    ARTCC_BOUNDARIES_PATH,
    "artcc",
  );
}

export async function buildAppDepBoundaries(): Promise<FacilityBoundary[]> {
  return buildFacilityBoundariesFromFixture(
    FIXTURE_APP_DEP_GEOJSON,
    APP_DEP_BOUNDARIES_PATH,
    "app_dep",
  );
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
  catalogCount: number;
  designatorCount: number;
  ringCount: number;
  highwayCount: number;
  artccCount: number;
  appDepCount: number;
}> {
  const [
    toweredText,
    catalogText,
    designatorsText,
    ringsText,
    highwaysText,
    artccText,
    appDepText,
  ] = await Promise.all([
    readFile(TOWERED_AIRPORTS_PATH, "utf8"),
    readFile(AIRPORTS_CATALOG_PATH, "utf8").catch(() => null),
    readFile(AIRPORT_DESIGNATORS_PATH, "utf8").catch(() => "{}"),
    readFile(AIRSPACE_RINGS_PATH, "utf8"),
    readFile(HIGHWAYS_PATH, "utf8").catch(() => "[]"),
    readFile(ARTCC_BOUNDARIES_PATH, "utf8").catch(() => "[]"),
    readFile(APP_DEP_BOUNDARIES_PATH, "utf8").catch(() => "[]"),
  ]);

  const towered = normalizeMapAirports(JSON.parse(toweredText) as Partial<MapAirport>[]);
  const catalog = catalogText
    ? normalizeMapAirports(JSON.parse(catalogText) as Partial<MapAirport>[])
    : towered;
  const designators = JSON.parse(designatorsText) as Record<string, string>;
  const rings = JSON.parse(ringsText) as AirspaceRing[];
  const highways = JSON.parse(highwaysText) as HighwayPolyline[];
  const artcc = JSON.parse(artccText) as FacilityBoundary[];
  const appDep = JSON.parse(appDepText) as FacilityBoundary[];

  const redis = getRedis();
  await Promise.all([
    redis.set(REDIS_KEYS.mapTowered, towered),
    redis.set(REDIS_KEYS.mapCatalog, catalog),
    redis.set(REDIS_KEYS.mapDesignators, designators),
    redis.set(REDIS_KEYS.mapAirspace, rings),
    redis.set(REDIS_KEYS.mapHighways, highways),
    redis.set(REDIS_KEYS.mapArtcc, artcc),
    redis.set(REDIS_KEYS.mapAppDep, appDep),
  ]);

  cachedMapData = {
    towered: catalog,
    designators,
    rings,
    highways,
    artcc,
    appDep,
  };

  return {
    toweredCount: towered.length,
    catalogCount: catalog.length,
    designatorCount: Object.keys(designators).length,
    ringCount: rings.length,
    highwayCount: highways.length,
    artccCount: artcc.length,
    appDepCount: appDep.length,
  };
}

type MapDataBlobs = {
  towered: MapAirport[];
  designators: Record<string, string>;
  rings: AirspaceRing[];
  highways: HighwayPolyline[];
  artcc: FacilityBoundary[];
  appDep: FacilityBoundary[];
};

let cachedMapData: MapDataBlobs | null = null;

function normalizeMapAirport(raw: Partial<MapAirport> & {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}): MapAirport {
  return {
    icao: raw.icao,
    ident: raw.ident ?? raw.icao,
    name: raw.name,
    lat: raw.lat,
    lon: raw.lon,
    towered: raw.towered ?? true,
    publicUse: raw.publicUse ?? false,
    pavedRunwayFt: raw.pavedRunwayFt ?? null,
    primaryRunwayHeadingDeg: raw.primaryRunwayHeadingDeg ?? null,
  };
}

function normalizeMapAirports(raw: Partial<MapAirport>[]): MapAirport[] {
  return raw
    .filter(
      (airport): airport is Partial<MapAirport> & {
        icao: string;
        name: string;
        lat: number;
        lon: number;
      } =>
        typeof airport.icao === "string" &&
        typeof airport.name === "string" &&
        typeof airport.lat === "number" &&
        typeof airport.lon === "number",
    )
    .map((airport) => normalizeMapAirport(airport));
}

async function readAirportsFromDisk(): Promise<MapAirport[]> {
  try {
    const catalogText = await readFile(AIRPORTS_CATALOG_PATH, "utf8");
    return normalizeMapAirports(JSON.parse(catalogText) as Partial<MapAirport>[]);
  } catch {
    const toweredText = await readFile(TOWERED_AIRPORTS_PATH, "utf8");
    return normalizeMapAirports(JSON.parse(toweredText) as Partial<MapAirport>[]);
  }
}

async function readMapDataFromDisk(): Promise<MapDataBlobs> {
  const [towered, designators, ringsText, highwaysText, artcc, appDep] =
    await Promise.all([
      readAirportsFromDisk(),
      readOptionalJsonFile<Record<string, string>>(AIRPORT_DESIGNATORS_PATH, {}),
      readFile(AIRSPACE_RINGS_PATH, "utf8"),
      readFile(HIGHWAYS_PATH, "utf8").catch(() => "[]"),
      readOptionalJsonFile<FacilityBoundary[]>(ARTCC_BOUNDARIES_PATH, []),
      readOptionalJsonFile<FacilityBoundary[]>(APP_DEP_BOUNDARIES_PATH, []),
    ]);

  return {
    towered,
    designators,
    rings: JSON.parse(ringsText) as AirspaceRing[],
    highways: JSON.parse(highwaysText) as HighwayPolyline[],
    artcc,
    appDep,
  };
}

async function readMapDataFromRedis(): Promise<MapDataBlobs | null> {
  try {
    const redis = getRedis();
    const [towered, catalog, designators, rings, highways, artcc, appDep] =
      await Promise.all([
        redis.get<MapAirport[]>(REDIS_KEYS.mapTowered),
        redis.get<MapAirport[]>(REDIS_KEYS.mapCatalog),
        redis.get<Record<string, string>>(REDIS_KEYS.mapDesignators),
        redis.get<AirspaceRing[]>(REDIS_KEYS.mapAirspace),
        redis.get<HighwayPolyline[]>(REDIS_KEYS.mapHighways),
        redis.get<FacilityBoundary[]>(REDIS_KEYS.mapArtcc),
        redis.get<FacilityBoundary[]>(REDIS_KEYS.mapAppDep),
      ]);
    if (!Array.isArray(towered) || !Array.isArray(rings)) {
      return null;
    }
    const airports = Array.isArray(catalog)
      ? normalizeMapAirports(catalog)
      : normalizeMapAirports(towered);
    return {
      towered: airports,
      designators:
        designators && typeof designators === "object" ? designators : {},
      rings,
      highways: Array.isArray(highways) ? highways : [],
      artcc: Array.isArray(artcc) ? artcc : [],
      appDep: Array.isArray(appDep) ? appDep : [],
    };
  } catch {
    return null;
  }
}

/** Load map context blobs once per warm isolate (Redis, then disk). */
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
