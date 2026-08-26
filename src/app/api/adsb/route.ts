import { fetchAdsbNearby } from "@/lib/fetchers/adsb";

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampRadiusNm(radiusNm: number): number {
  if (radiusNm < 1) {
    return 1;
  }
  if (radiusNm > 250) {
    return 250;
  }
  return radiusNm;
}

/**
 * Thin browser-facing proxy for community ADS-B APIs (no CORS on upstream).
 * Tries adsb.lol then opendata.adsb.fi. Does not cache — mirrors firmware's
 * direct poll pattern.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseNumber(searchParams.get("lat"));
  const lon = parseNumber(searchParams.get("lon"));
  const distRaw = parseNumber(searchParams.get("dist"));

  if (lat == null || lon == null) {
    return Response.json(
      { error: "missing or invalid lat/lon" },
      { status: 400 },
    );
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: "lat/lon out of range" }, { status: 400 });
  }

  const dist = clampRadiusNm(distRaw ?? 25);
  const result = await fetchAdsbNearby(lat, lon, dist);

  if (!result.ok) {
    return Response.json(
      { error: result.error, upstream: result.upstream },
      { status: 502 },
    );
  }

  return new Response(result.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-ADSB-Upstream": result.upstream,
    },
  });
}
