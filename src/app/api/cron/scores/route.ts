import { authorizeCron } from "@/lib/cron-auth";
import { getConfig, REDIS_KEYS } from "@/lib/config";
import { fetchFlagstand } from "@/lib/fetchers/flagstand";
import { fetchMlb } from "@/lib/fetchers/mlb";
import { getRedis } from "@/lib/redis";
import type { ScoresBlob } from "@/lib/types/scores";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { mlbTeam, flagstandLeagueIds } = getConfig();

    const [mlb, flagstandResult] = await Promise.all([
      fetchMlb(mlbTeam),
      fetchFlagstand(flagstandLeagueIds),
    ]);

    const { error: _flagstandError, ...flagstand } = flagstandResult;

    const blob: ScoresBlob = {
      mlb,
      flagstand,
      updatedAt: new Date().toISOString(),
    };

    await getRedis().set(REDIS_KEYS.scores, blob);

    return Response.json({
      ok: true,
      ...(flagstandResult.error ? { flagstandWarning: flagstandResult.error } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scores cron failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
