import { authorizeCron } from "@/lib/cron-auth";
import { REDIS_KEYS } from "@/lib/config";
import { fetchAllSunrise } from "@/lib/fetchers/sunrise";
import { getRedis } from "@/lib/redis";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { cities, failures } = await fetchAllSunrise();
  const cityCount = Object.keys(cities).length;

  if (cityCount === 0) {
    return Response.json(
      { ok: false, error: "All city fetches failed", failures },
      { status: 502 },
    );
  }

  if (failures.length > 0) {
    console.warn("Timezone cron completed with partial failures:", failures);
  }

  const blob = {
    updatedAt: new Date().toISOString(),
    cities,
  };

  await getRedis().set(REDIS_KEYS.timezones, blob);

  return Response.json({ ok: true, cities: cityCount });
}
