import { lookupAirportCoords } from "@/lib/fetchers/airports";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const coords = await lookupAirportCoords(code);

  if (!coords) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json(coords);
}
