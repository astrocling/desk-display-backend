import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type { TimezonesBlob } from "@/lib/types/timezones";

export async function GET() {
  const data = await getRedis().get<TimezonesBlob>(REDIS_KEYS.timezones);

  if (!data?.cities || Object.keys(data.cities).length === 0) {
    return Response.json(
      { error: "Timezones data not available" },
      { status: 503 },
    );
  }

  // Firmware contract: flat IANA → { sunrise, sunset } (updatedAt stays in Redis only)
  return Response.json(data.cities);
}
