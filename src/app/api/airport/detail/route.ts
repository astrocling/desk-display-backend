import { getAirportDetail } from "@/lib/fetchers/airport_detail";
import { loadMapContextData } from "@/lib/fetchers/map_context";

/**
 * GET /api/airport/detail?icao=KDAY
 * Returns runways + METAR for airport detail card / ground mode.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao = (searchParams.get("icao") ?? searchParams.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!icao || icao.length < 3 || icao.length > 4) {
    return Response.json({ error: "missing or invalid icao" }, { status: 400 });
  }

  try {
    const { towered } = await loadMapContextData();
    const known = towered.find((a) => a.icao === icao);
    const detail = await getAirportDetail({
      icao,
      name: known?.name,
      lat: known?.lat,
      lon: known?.lon,
    });

    if (
      detail.lat === 0 &&
      detail.lon === 0 &&
      detail.runways.length === 0 &&
      !known
    ) {
      return Response.json({ error: "airport not found" }, { status: 404 });
    }

    return Response.json(detail, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "airport detail failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
