import {
  buildCatalogByIdent,
  lookupAirportByDesignator,
} from "@/lib/fetchers/airport_lookup";
import { loadMapContextData } from "@/lib/fetchers/map_context";

const CACHE_CONTROL =
  "public, s-maxage=86400, max-age=3600, stale-while-revalidate=86400";

/**
 * GET /api/map/airport-lookup?q=
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (q == null || q.trim() === "") {
    return Response.json({ error: "missing q" }, { status: 400 });
  }

  try {
    const { towered, designators } = await loadMapContextData();
    const catalogByIdent = buildCatalogByIdent(towered);
    const result = lookupAirportByDesignator(q, designators, catalogByIdent);
    return Response.json(result, {
      status: result.ok ? 200 : 404,
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "airport lookup unavailable";
    return Response.json({ error: message }, { status: 503 });
  }
}
