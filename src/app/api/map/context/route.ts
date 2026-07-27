import {
  filterMapContext,
  loadMapContextData,
} from "@/lib/fetchers/map_context";
import {
  attachPrimaryRunwayHeadings,
  loadRunwaysByIcao,
} from "@/lib/fetchers/airport_detail";
import {
  MAP_CONTEXT_MAX_MI,
  MAP_CONTEXT_MIN_MI,
} from "@/components/radar/geo";

const CACHE_CONTROL =
  "public, s-maxage=86400, max-age=3600, stale-while-revalidate=86400";

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampRadiusMi(radiusMi: number): number {
  if (radiusMi < MAP_CONTEXT_MIN_MI) {
    return MAP_CONTEXT_MIN_MI;
  }
  if (radiusMi > MAP_CONTEXT_MAX_MI) {
    return MAP_CONTEXT_MAX_MI;
  }
  return radiusMi;
}

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

  const radiusMi = clampRadiusMi(radiusRaw ?? 25);

  try {
    const [{ towered, rings, highways }, runwaysByIcao] = await Promise.all([
      loadMapContextData(),
      loadRunwaysByIcao(),
    ]);
    const body = filterMapContext(lat, lon, radiusMi, towered, rings, highways);
    body.airports = attachPrimaryRunwayHeadings(body.airports, runwaysByIcao);
    return Response.json(body, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "map context unavailable";
    return Response.json({ error: message }, { status: 503 });
  }
}
