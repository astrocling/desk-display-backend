/** Map Redis / config failures to a JSON Response instead of an opaque Next 500. */
export function wpblApiErrorResponse(error: unknown): Response {
  const message =
    error instanceof Error ? error.message : "WPBL API request failed";
  const missingEnv =
    /Missing required environment variable/i.test(message) ||
    /UPSTASH_REDIS|KV_REST_API/i.test(message);

  return Response.json(
    {
      error: missingEnv
        ? "Redis is not configured. Add UPSTASH_REDIS_* or KV_REST_API_* to .env.local (e.g. vercel env pull)."
        : message,
    },
    { status: missingEnv ? 503 : 500 },
  );
}
