import { getConfig, REDIS_KEYS } from "@/lib/config";
import { fetchMlb } from "@/lib/fetchers/mlb";
import { fetchWpbl } from "@/lib/fetchers/wpbl";
import { getRedis } from "@/lib/redis";
import { shouldRefreshLiveScores } from "@/lib/scores-refresh";
import type { ScoresBlob } from "@/lib/types/scores";

const emptyWpbl = { games: [], standings: [] };

export async function GET() {
  const redis = getRedis();
  const blob = await redis.get<ScoresBlob>(REDIS_KEYS.scores);

  if (!blob) {
    return Response.json({ error: "scores not ready" }, { status: 503 });
  }

  const normalized: ScoresBlob = {
    ...blob,
    wpbl: blob.wpbl ?? emptyWpbl,
  };

  if (!shouldRefreshLiveScores(normalized)) {
    return Response.json(normalized);
  }

  try {
    const { mlbTeam } = getConfig();
    const [mlb, wpblResult] = await Promise.all([
      fetchMlb(mlbTeam, {
        preserveStanding: {
          record: blob.mlb.record,
          standingLine: blob.mlb.standingLine,
        },
      }),
      fetchWpbl(),
    ]);

    const { error: _wpblError, ...wpblFresh } = wpblResult;
    const next: ScoresBlob = {
      mlb,
      flagstand: blob.flagstand,
      wpbl: wpblResult.error
        ? (blob.wpbl ?? emptyWpbl)
        : { games: wpblFresh.games, standings: wpblFresh.standings },
      updatedAt: new Date().toISOString(),
    };

    await redis.set(REDIS_KEYS.scores, next);
    return Response.json(next);
  } catch {
    // ESPN blip — keep serving last good cache.
    return Response.json(normalized);
  }
}
