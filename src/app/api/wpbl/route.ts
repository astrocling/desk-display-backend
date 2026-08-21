import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type { WpblLeagueResponse } from "@/lib/types/wpbl-display";

export async function GET() {
  const blob = await getRedis().get<WpblLeagueResponse>(REDIS_KEYS.wpblLeague);

  if (!blob) {
    return Response.json({ error: "WPBL league cache empty" }, { status: 503 });
  }

  return Response.json(blob);
}
