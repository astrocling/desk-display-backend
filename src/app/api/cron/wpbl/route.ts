import { authorizeCron } from "@/lib/cron-auth";
import {
  refreshWpblLeaders,
  refreshWpblLeague,
} from "@/lib/fetchers/wpbl-v1/refresh";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const league = await refreshWpblLeague();
    const leaders = await refreshWpblLeaders(league.seasonId);

    return Response.json({
      ok: true,
      games: league.games.length,
      leadersPartial: leaders.partial,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WPBL cron failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
