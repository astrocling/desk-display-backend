/**
 * Active FAA TFRs — filter by viewport. Uses FAA TFR list JSON when available.
 */

import { haversineMiles } from "@/lib/fetchers/map_context";

export interface TfrPolygon {
  id: string;
  name: string;
  type: string;
  points: [number, number][];
}

const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 15 * 60_000;

/** FAA TFR ArcGIS FeatureServer (national active TFRs). */
const TFR_FEATURE_URL =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/TFR_Areas/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&resultRecordCount=500";

type Cache = { at: number; tfrs: TfrPolygon[] };
let cache: Cache | null = null;

function ringBbox(points: [number, number][]) {
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

function intersectsRadius(
  points: [number, number][],
  lat: number,
  lon: number,
  radiusMi: number,
): boolean {
  if (points.length < 3) return false;
  const bbox = ringBbox(points);
  const latPad = radiusMi / 69;
  const lonPad = radiusMi / (Math.cos((lat * Math.PI) / 180) * 69 || 69);
  if (
    bbox.maxLat < lat - latPad ||
    bbox.minLat > lat + latPad ||
    bbox.maxLon < lon - lonPad ||
    bbox.minLon > lon + lonPad
  ) {
    return false;
  }
  for (const [pLat, pLon] of points) {
    if (haversineMiles(lat, lon, pLat, pLon) <= radiusMi) return true;
  }
  return false;
}

function lonLatRingToLatLon(ring: number[][]): [number, number][] {
  return ring
    .filter((c) => c.length >= 2)
    .map((c) => [c[1], c[0]] as [number, number]);
}

export function parseTfrGeoJson(geojson: unknown): TfrPolygon[] {
  if (!geojson || typeof geojson !== "object") return [];
  const doc = geojson as {
    type?: string;
    features?: Array<{
      id?: string | number;
      properties?: Record<string, unknown>;
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  };
  if (doc.type !== "FeatureCollection" || !Array.isArray(doc.features)) {
    return [];
  }

  const out: TfrPolygon[] = [];
  for (const feature of doc.features) {
    const props = feature.properties ?? {};
    const id = String(
      props.NOTAM_ID ??
        props.GLOBAL_ID ??
        props.OBJECTID ??
        feature.id ??
        out.length,
    );
    const name = String(
      props.NAME ?? props.NOTAM ?? props.TYPE ?? `TFR ${id}`,
    );
    const type = String(props.TYPE ?? props.CATEGORY ?? "TFR");
    const geometry = feature.geometry;
    if (!geometry?.coordinates) continue;

    const rings: number[][][] = [];
    if (geometry.type === "Polygon") {
      const coords = geometry.coordinates as number[][][];
      if (coords[0]) rings.push(coords[0]);
    } else if (geometry.type === "MultiPolygon") {
      for (const poly of geometry.coordinates as number[][][][]) {
        if (poly[0]) rings.push(poly[0]);
      }
    }

    for (let i = 0; i < rings.length; i++) {
      const points = lonLatRingToLatLon(rings[i]);
      if (points.length < 3) continue;
      out.push({
        id: i === 0 ? id : `${id}_${i}`,
        name,
        type,
        points,
      });
    }
  }
  return out;
}

async function fetchAllTfrs(): Promise<TfrPolygon[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.tfrs;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(TFR_FEATURE_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return cache?.tfrs ?? [];
    }
    const geojson = (await res.json()) as unknown;
    const tfrs = parseTfrGeoJson(geojson);
    cache = { at: Date.now(), tfrs };
    return tfrs;
  } catch {
    return cache?.tfrs ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function filterActiveTfrs(
  lat: number,
  lon: number,
  radiusMi: number,
): Promise<TfrPolygon[]> {
  const all = await fetchAllTfrs();
  return all.filter((t) => intersectsRadius(t.points, lat, lon, radiusMi));
}

export function clearTfrCacheForTests(): void {
  cache = null;
}
