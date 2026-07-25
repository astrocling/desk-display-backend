import {
  getRadarWatchlist,
  setRadarWatchlist,
} from "@/lib/radar-watchlist";

export async function GET() {
  try {
    const regs = await getRadarWatchlist();
    return Response.json(
      { regs },
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

  if (!body || typeof body !== "object" || !("regs" in body)) {
    return Response.json({ error: "missing regs" }, { status: 400 });
  }

  try {
    const regs = await setRadarWatchlist(
      (body as { regs: unknown }).regs,
    );
    return Response.json(
      { regs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "watchlist save failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
