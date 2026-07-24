import { authorizeCron } from "@/lib/cron-auth";
import { seedMapContextToRedis } from "@/lib/fetchers/map_context";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await seedMapContextToRedis();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Map context seed failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
