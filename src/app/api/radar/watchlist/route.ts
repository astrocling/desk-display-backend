import {
  getRadarWatchlist,
  setRadarWatchlist,
} from "@/lib/radar-watchlist";

export async function GET() {
  try {
    const entries = await getRadarWatchlist();
    return Response.json(
      { entries },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "watchlist load failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("entries" in body)) {
    return Response.json({ error: "missing entries" }, { status: 400 });
  }

  try {
    const entries = await setRadarWatchlist(
      (body as { entries: unknown }).entries,
    );
    return Response.json(
      { entries },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "watchlist save failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
