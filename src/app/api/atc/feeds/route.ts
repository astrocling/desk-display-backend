import { ATC_FEEDS, feedsForIcao } from "@/lib/atc/feeds";

/**
 * Curated ATC feed catalog for the radar Comms panel.
 * GET /api/atc/feeds — full catalog
 * GET /api/atc/feeds?icao=KDAY — feeds for one airport
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icaoRaw = searchParams.get("icao");

  if (icaoRaw != null && icaoRaw.trim() === "") {
    return Response.json(
      { error: "missing or invalid icao" },
      { status: 400 },
    );
  }

  if (icaoRaw == null) {
    return Response.json(
      { feeds: ATC_FEEDS },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const icao = icaoRaw.trim().toUpperCase();
  return Response.json(
    { icao, feeds: feedsForIcao(icao) },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
