import { authorizeCron } from "@/lib/cron-auth";
import {
  leaderPlayerIdsToWarm,
  refreshWpblLeaders,
  refreshWpblLeague,
  warmWpblPlayers,
} from "@/lib/fetchers/wpbl-v1/refresh";
import { fetchWpblHeadshotMap } from "@/lib/fetchers/wpbl-v1/headshots";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    // Warm headshots first so player detail builds during warm can reuse Redis.
    await fetchWpblHeadshotMap().catch(() => null);

    const league = await refreshWpblLeague();
    const leaders = await refreshWpblLeaders(league.seasonId);
    const warmIds = leaderPlayerIdsToWarm(leaders, 10);
    const warm = await warmWpblPlayers(warmIds, league.seasonId, 4);

    return Response.json({
      ok: true,
      games: league.games.length,
      leadersPartial: leaders.partial,
      playersWarmed: warm.warmed,
      playersWarmFailed: warm.failed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WPBL cron failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
