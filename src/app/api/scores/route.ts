import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type { ScoresBlob } from "@/lib/types/scores";

export async function GET() {
  const blob = await getRedis().get<ScoresBlob>(REDIS_KEYS.scores);

  if (!blob) {
    return Response.json({ error: "scores not ready" }, { status: 503 });
  }

  return Response.json(blob);
}
