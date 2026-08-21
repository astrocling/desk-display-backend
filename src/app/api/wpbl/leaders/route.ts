import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type { WpblLeadersResponse } from "@/lib/types/wpbl-display";

export async function GET() {
  const blob = await getRedis().get<WpblLeadersResponse>(REDIS_KEYS.wpblLeaders);

  if (!blob) {
    return Response.json({ error: "WPBL leaders cache empty" }, { status: 503 });
  }

  return Response.json(blob);
}
