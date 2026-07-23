import { authorizeCron } from "@/lib/cron-auth";
import { getConfig, REDIS_KEYS } from "@/lib/config";
import { fetchNwsAlerts } from "@/lib/fetchers/nws";
import { fetchWeather } from "@/lib/fetchers/weather";
import { getRedis } from "@/lib/redis";
import type { WeatherBlob } from "@/lib/types/weather";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { homeLat, homeLon } = getConfig();

    const [weather, alert] = await Promise.all([
      fetchWeather(homeLat, homeLon),
      fetchNwsAlerts(homeLat, homeLon),
    ]);

    const blob: WeatherBlob = {
      ...weather,
      alert,
    };

    await getRedis().set(REDIS_KEYS.weather, blob);

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Weather cron failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
