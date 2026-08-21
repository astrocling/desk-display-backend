export const WPBL_API_BASE = "https://stats.womensprobaseballleague.com";

export class WpblHttpError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(path: string, status: number) {
    super(`WPBL ${path} failed: ${status}`);
    this.name = "WpblHttpError";
    this.path = path;
    this.status = status;
  }
}

type CacheEntry = { expiresAt: number; value: unknown };

const responseCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

export async function fetchWpblJson<T>(
  path: string,
  options?: { ttlMs?: number },
): Promise<T> {
  const url = path.startsWith("http") ? path : `${WPBL_API_BASE}${path}`;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new WpblHttpError(path, response.status);
  }
  const value = (await response.json()) as T;
  if (ttlMs > 0) {
    responseCache.set(url, { expiresAt: Date.now() + ttlMs, value });
  }
  return value;
}
