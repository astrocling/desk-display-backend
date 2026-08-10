import { authorizeCron } from "@/lib/cron-auth";
import { getConfig, REDIS_KEYS } from "@/lib/config";
import { fetchFlagstand } from "@/lib/fetchers/flagstand";
import { fetchMlb } from "@/lib/fetchers/mlb";
import { fetchWpbl } from "@/lib/fetchers/wpbl";
import { getRedis } from "@/lib/redis";
import type { ScoresBlob } from "@/lib/types/scores";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { mlbTeam, flagstandLeagueIds } = getConfig();

    const [mlb, flagstandResult, wpblResult] = await Promise.all([
      fetchMlb(mlbTeam),
      fetchFlagstand(flagstandLeagueIds),
      fetchWpbl(),
    ]);

    const { error: _flagstandError, ...flagstand } = flagstandResult;
    const { error: _wpblError, ...wpbl } = wpblResult;

    const blob: ScoresBlob = {
      mlb,
      flagstand,
      wpbl: { games: wpbl.games, standings: wpbl.standings },
      updatedAt: new Date().toISOString(),
    };

    await getRedis().set(REDIS_KEYS.scores, blob);

    return Response.json({
      ok: true,
      ...(flagstandResult.error
        ? { flagstandWarning: flagstandResult.error }
        : {}),
      ...(wpblResult.error ? { wpblWarning: wpblResult.error } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scores cron failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
