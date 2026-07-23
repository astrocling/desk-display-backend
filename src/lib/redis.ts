import { Redis } from "@upstash/redis";

import { getRequiredEnv } from "@/lib/config";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: getRequiredEnv("UPSTASH_REDIS_REST_URL"),
      token: getRequiredEnv("UPSTASH_REDIS_REST_TOKEN"),
    });
  }

  return redis;
}
