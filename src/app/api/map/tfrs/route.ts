import { filterActiveTfrs } from "@/lib/fetchers/tfrs";
import {
  MAP_CONTEXT_MAX_MI,
  MAP_CONTEXT_MIN_MI,
} from "@/components/radar/geo";

const CACHE_CONTROL =
  "public, s-maxage=300, max-age=60, stale-while-revalidate=600";

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampRadiusMi(radiusMi: number): number {
  if (radiusMi < MAP_CONTEXT_MIN_MI) return MAP_CONTEXT_MIN_MI;
  if (radiusMi > MAP_CONTEXT_MAX_MI) return MAP_CONTEXT_MAX_MI;
  return radiusMi;
}

/**
 * GET /api/map/tfrs?lat=&lon=&radiusMi=
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseNumber(searchParams.get("lat"));
  const lon = parseNumber(searchParams.get("lon"));
  const radiusRaw = parseNumber(searchParams.get("radiusMi"));

  if (lat == null || lon == null) {
    return Response.json(
      { error: "missing or invalid lat/lon" },
      { status: 400 },
    );
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: "lat/lon out of range" }, { status: 400 });
  }

  const radiusMi = clampRadiusMi(radiusRaw ?? 50);
  try {
    const tfrs = await filterActiveTfrs(lat, lon, radiusMi);
    return Response.json(
      { tfrs },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "tfr fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
