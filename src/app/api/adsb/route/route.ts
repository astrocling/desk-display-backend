import { lookupRoute, lookupRoutesBulk } from "@/lib/fetchers/flight_routes";

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/adsb/route?callsign=AAL200&lat=&lon=
 * POST /api/adsb/route  { planes: [{ callsign, lat?, lon? }] }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callsign = searchParams.get("callsign")?.trim() ?? "";
  if (!callsign) {
    return Response.json({ error: "missing callsign" }, { status: 400 });
  }
  const lat = parseNumber(searchParams.get("lat"));
  const lon = parseNumber(searchParams.get("lon"));
  const body = await lookupRoute(callsign, lat, lon);
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=120" },
  });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const planes = (json as { planes?: unknown }).planes;
  if (!Array.isArray(planes) || planes.length === 0) {
    return Response.json({ error: "planes required" }, { status: 400 });
  }
  if (planes.length > 80) {
    return Response.json({ error: "too many planes" }, { status: 400 });
  }

  const parsed: Array<{
    callsign: string;
    lat?: number | null;
    lon?: number | null;
  }> = [];
  for (const p of planes) {
    if (!p || typeof p !== "object") continue;
    const callsign = String((p as { callsign?: unknown }).callsign ?? "").trim();
    if (!callsign) continue;
    const lat = (p as { lat?: unknown }).lat;
    const lon = (p as { lon?: unknown }).lon;
    parsed.push({
      callsign,
      lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
      lon: typeof lon === "number" && Number.isFinite(lon) ? lon : null,
    });
  }

  const routes = await lookupRoutesBulk(parsed);
  return Response.json(
    { routes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
