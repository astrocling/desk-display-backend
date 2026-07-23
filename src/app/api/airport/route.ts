import { REDIS_KEYS } from "@/lib/config";
import type { AirportCoords } from "@/lib/fetchers/airports";
import { getRedis } from "@/lib/redis";

function parseCoords(value: unknown): AirportCoords | null {
  if (
    value &&
    typeof value === "object" &&
    "lat" in value &&
    "lon" in value &&
    typeof value.lat === "number" &&
    typeof value.lon === "number"
  ) {
    return { lat: value.lat, lon: value.lon };
  }

  if (typeof value === "string") {
    try {
      return parseCoords(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const value = await getRedis().hget(REDIS_KEYS.airports, code.toUpperCase());
  const coords = parseCoords(value);

  if (!coords) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json(coords);
}
