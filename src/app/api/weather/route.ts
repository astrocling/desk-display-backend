import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type { WeatherBlob } from "@/lib/types/weather";

export async function GET() {
  const blob = await getRedis().get<WeatherBlob>(REDIS_KEYS.weather);

  if (!blob) {
    return Response.json({ error: "weather not ready" }, { status: 503 });
  }

  return Response.json(blob);
}
