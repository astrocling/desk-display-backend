/**
 * Callsign → origin/arrival airport lookup via VRS standing-data
 * (same dataset adsb.lol routeset uses). Prefer CDN; fall back to GET route.
 */

import { parseAirportCodes } from "@/lib/fetchers/flight_routes_parse";

const VRS_STANDING_BASE = "https://vrs-standing-data.adsb.lol/routes";
const ADSB_ROUTE_BASE = "https://api.adsb.lol/api/0/route";
const FETCH_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 10 * 60_000;

export interface RouteLookup {
  callsign: string;
  originIcao: string | null;
  arrivalIcao: string | null;
  airportCodes: string | null;
  plausible: boolean | null;
}

type CacheEntry = { at: number; value: RouteLookup };

const memoryCache = new Map<string, CacheEntry>();

function normalizeCallsign(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fromStandingPayload(
  callsign: string,
  data: Record<string, unknown>,
  plausible: boolean | null,
): RouteLookup {
  const airportCodes =
    typeof data.airport_codes === "string" ? data.airport_codes : null;
  const { originIcao, arrivalIcao } = parseAirportCodes(airportCodes);
  return {
    callsign,
    originIcao,
    arrivalIcao,
    airportCodes: airportCodes === "unknown" ? null : airportCodes,
    plausible,
  };
}

async function fetchStandingData(
  callsign: string,
): Promise<RouteLookup | null> {
  if (callsign.length < 3) return null;
  const prefix = callsign.slice(0, 2);
  const data = await fetchJson(
    `${VRS_STANDING_BASE}/${prefix}/${callsign}.json`,
  );
  if (!data || typeof data !== "object") return null;
  return fromStandingPayload(callsign, data as Record<string, unknown>, null);
}

async function fetchAdsbRoute(
  callsign: string,
  lat: number | null,
  lon: number | null,
): Promise<RouteLookup | null> {
  const url =
    lat != null && lon != null
      ? `${ADSB_ROUTE_BASE}/${encodeURIComponent(callsign)}/${lat}/${lon}`
      : null;
  if (!url) return null;
  const data = await fetchJson(url);
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const plausible =
    typeof obj.plausible === "boolean" ? obj.plausible : null;
  return fromStandingPayload(callsign, obj, plausible);
}

export async function lookupRoute(
  rawCallsign: string,
  lat: number | null = null,
  lon: number | null = null,
): Promise<RouteLookup> {
  const callsign = normalizeCallsign(rawCallsign);
  const empty: RouteLookup = {
    callsign,
    originIcao: null,
    arrivalIcao: null,
    airportCodes: null,
    plausible: null,
  };
  if (!callsign) return empty;

  const cached = memoryCache.get(callsign);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  let result = await fetchStandingData(callsign);
  if (!result || !result.arrivalIcao) {
    result = (await fetchAdsbRoute(callsign, lat, lon)) ?? result;
  } else if (lat != null && lon != null && result.plausible == null) {
    const withPlausible = await fetchAdsbRoute(callsign, lat, lon);
    if (withPlausible?.plausible != null) {
      result = { ...result, plausible: withPlausible.plausible };
    }
  }

  const value = result ?? empty;
  memoryCache.set(callsign, { at: Date.now(), value });
  return value;
}

export async function lookupRoutesBulk(
  planes: Array<{ callsign: string; lat?: number | null; lon?: number | null }>,
): Promise<RouteLookup[]> {
  const unique = new Map<
    string,
    { callsign: string; lat: number | null; lon: number | null }
  >();
  for (const p of planes) {
    const cs = normalizeCallsign(p.callsign);
    if (!cs || unique.has(cs)) continue;
    unique.set(cs, {
      callsign: cs,
      lat: p.lat ?? null,
      lon: p.lon ?? null,
    });
  }

  return Promise.all(
    [...unique.values()].map((p) => lookupRoute(p.callsign, p.lat, p.lon)),
  );
}

/** Test helper */
export function clearRouteCacheForTests(): void {
  memoryCache.clear();
}
