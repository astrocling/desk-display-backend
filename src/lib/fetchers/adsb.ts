/**
 * Live ADS-B position fetch with provider fallback.
 * Community endpoints (adsb.lol, adsb.fi) share the readsb/ADSBX v2 shape;
 * we normalize to `{ ac: [...] }` for the radar client.
 */

const FETCH_TIMEOUT_MS = 8_000;

export type AdsbUpstream = {
  name: string;
  /** Build request URL for lat/lon/radius (nm). */
  buildUrl: (lat: number, lon: number, distNm: number) => string;
};

/** Primary + fallback community mirrors (same v2 lat/lon/dist contract). */
export const ADSB_UPSTREAMS: readonly AdsbUpstream[] = [
  {
    name: "adsb.lol",
    buildUrl: (lat, lon, dist) =>
      `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
  },
  {
    name: "adsb.fi",
    buildUrl: (lat, lon, dist) =>
      `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
  },
];

/**
 * Normalize provider JSON so the browser always sees `ac` (adsb.lol shape).
 * adsb.fi uses `aircraft` instead of `ac`.
 */
export function normalizeAdsbPayload(data: unknown): {
  ac: unknown[];
  msg?: string;
  now?: number;
  total?: number;
  sourceExtra?: Record<string, unknown>;
} {
  if (!data || typeof data !== "object") {
    return { ac: [] };
  }
  const obj = data as Record<string, unknown>;
  const list = Array.isArray(obj.ac)
    ? obj.ac
    : Array.isArray(obj.aircraft)
      ? obj.aircraft
      : [];

  const { ac: _ac, aircraft: _aircraft, ...rest } = obj;
  return {
    ...rest,
    ac: list,
    total: typeof obj.total === "number" ? obj.total : list.length,
  };
}

export type AdsbFetchResult =
  | { ok: true; body: string; upstream: string }
  | { ok: false; status: number; error: string; upstream?: string };

/**
 * Try each upstream until one returns OK JSON. Failures (4xx/5xx/timeout)
 * fall through so a transient adsb.lol outage does not blank the radar.
 */
export async function fetchAdsbNearby(
  lat: number,
  lon: number,
  distNm: number,
  upstreams: readonly AdsbUpstream[] = ADSB_UPSTREAMS,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsbFetchResult> {
  let lastStatus = 502;
  let lastError = "adsb upstream unavailable";
  let lastUpstream: string | undefined;

  for (const upstream of upstreams) {
    const url = upstream.buildUrl(lat, lon, distNm);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          // Some community CDNs treat missing/empty UA as abusive.
          "User-Agent": "desk-display-backend/radar (adsb-proxy)",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        lastStatus = res.status;
        lastError = `adsb upstream ${res.status}`;
        lastUpstream = upstream.name;
        continue;
      }

      const raw: unknown = await res.json();
      const normalized = normalizeAdsbPayload(raw);
      return {
        ok: true,
        body: JSON.stringify(normalized),
        upstream: upstream.name,
      };
    } catch (error) {
      lastStatus = 502;
      lastError =
        error instanceof Error ? error.message : "adsb proxy failed";
      lastUpstream = upstream.name;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502,
    error: lastError,
    upstream: lastUpstream,
  };
}
