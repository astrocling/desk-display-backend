import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

/** Vercel Marketplace Upstash uses KV_*; local/docs use UPSTASH_*. */
function redisRestUrl(): string {
  const value =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  if (!value) {
    throw new Error(
      "Missing required environment variable: UPSTASH_REDIS_REST_URL (or KV_REST_API_URL)",
    );
  }
  return value;
}

function redisRestToken(): string {
  const value =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!value) {
    throw new Error(
      "Missing required environment variable: UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)",
    );
  }
  return value;
}

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: redisRestUrl(),
      token: redisRestToken(),
    });
  }

  return redis;
}
