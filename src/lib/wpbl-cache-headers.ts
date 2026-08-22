/**
 * Shared Cache-Control for WPBL JSON that is Redis-backed and refreshed
 * in the background. Browsers/CDN can reuse briefly; SWR covers the rest.
 */
export const WPBL_API_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=300";

/** Live game payloads should not sit long at the edge. */
export const WPBL_LIVE_API_CACHE_CONTROL =
  "public, s-maxage=5, stale-while-revalidate=30";

export function jsonWithCache(
  data: unknown,
  cacheControl: string = WPBL_API_CACHE_CONTROL,
): Response {
  return Response.json(data, {
    headers: {
      "Cache-Control": cacheControl,
    },
  });
}
