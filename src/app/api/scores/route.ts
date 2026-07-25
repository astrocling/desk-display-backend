import { getConfig, REDIS_KEYS } from "@/lib/config";
import { fetchMlb } from "@/lib/fetchers/mlb";
import { getRedis } from "@/lib/redis";
import { shouldRefreshLiveScores } from "@/lib/scores-refresh";
import type { ScoresBlob } from "@/lib/types/scores";

export async function GET() {
  const redis = getRedis();
  const blob = await redis.get<ScoresBlob>(REDIS_KEYS.scores);

  if (!blob) {
    return Response.json({ error: "scores not ready" }, { status: 503 });
  }

  if (!shouldRefreshLiveScores(blob)) {
    return Response.json(blob);
  }

  try {
    const { mlbTeam } = getConfig();
    const mlb = await fetchMlb(mlbTeam, {
      preserveStanding: {
        record: blob.mlb.record,
        standingLine: blob.mlb.standingLine,
      },
    });

    const next: ScoresBlob = {
      mlb,
      flagstand: blob.flagstand,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(REDIS_KEYS.scores, next);
    return Response.json(next);
  } catch {
    // ESPN blip — keep serving last good cache.
    return Response.json(blob);
  }
}
