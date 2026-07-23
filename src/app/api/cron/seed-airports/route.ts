import { authorizeCron } from "@/lib/cron-auth";
import { seedAirportsToRedis } from "@/lib/fetchers/airports";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const count = await seedAirportsToRedis();
    return Response.json({ ok: true, count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Airport seed failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
