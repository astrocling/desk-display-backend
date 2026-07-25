import {
  filterMapContext,
  loadMapContextData,
} from "@/lib/fetchers/map_context";

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
  if (radiusMi < 5) {
    return 5;
  }
  if (radiusMi > 50) {
    return 50;
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
    const { towered, rings } = await loadMapContextData();
    const body = filterMapContext(lat, lon, radiusMi, towered, rings);
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
