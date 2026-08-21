/**
 * WPBL player headshots.
 *
 * Stats API exposes `headshot_url` on roster players, but it is currently empty
 * for the whole league. Official headshots live on the public WordPress site
 * (`wpbl_player` CPT) and link back via ACF `stats_player_id`.
 */

const WP_PLAYER_API =
  "https://www.womensprobaseballleague.com/wp-json/wp/v2/wpbl_player";

const DEFAULT_TTL_MS = 30 * 60_000;

type CacheEntry = { expiresAt: number; value: Map<string, string> };

let mapCache: CacheEntry | null = null;

interface WpAcfField {
  value?: unknown;
  value_formatted?: unknown;
  simple_value_formatted?: string;
}

interface WpPlayerPost {
  title?: { rendered?: string };
  acf?: {
    headshot?: WpAcfField | string | null;
    first_name?: WpAcfField | string | null;
    last_name?: WpAcfField | string | null;
    stats_player_id?: WpAcfField | string | null;
  } | null;
}

export function acfPlainValue(field: unknown): string {
  if (field == null) return "";
  if (typeof field === "string" || typeof field === "number") {
    return String(field).trim();
  }
  if (typeof field === "object") {
    const obj = field as WpAcfField;
    const raw = obj.value_formatted ?? obj.value;
    if (typeof raw === "string" || typeof raw === "number") {
      return String(raw).trim();
    }
  }
  return "";
}

/** Pull the first img src out of ACF image HTML (return_format is attachment id). */
export function extractHeadshotUrlFromAcf(headshot: unknown): string | null {
  if (headshot == null) return null;
  if (typeof headshot === "string") {
    const trimmed = headshot.trim();
    if (trimmed.startsWith("http")) return normalizeHeadshotUrl(trimmed);
    const fromHtml = srcFromHtml(trimmed);
    return fromHtml ? normalizeHeadshotUrl(fromHtml) : null;
  }
  if (typeof headshot === "object") {
    const obj = headshot as WpAcfField & { url?: string; source_url?: string };
    for (const key of ["url", "source_url"] as const) {
      const v = obj[key];
      if (typeof v === "string" && v.startsWith("http")) {
        return normalizeHeadshotUrl(v);
      }
    }
    const html = obj.simple_value_formatted ?? "";
    const fromHtml = srcFromHtml(html);
    if (fromHtml) return normalizeHeadshotUrl(fromHtml);
  }
  return null;
}

function srcFromHtml(html: string): string | null {
  const match = html.match(/src=["']([^"']+)["']/i);
  return match?.[1]?.replace(/&amp;/g, "&") ?? null;
}

/** Prefer a compact Jetpack/CDN size when present; otherwise return as-is. */
export function normalizeHeadshotUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("wp.com") || parsed.searchParams.has("fit")) {
      parsed.searchParams.set("w", "160");
      parsed.searchParams.set("quality", "80");
      parsed.searchParams.delete("fit");
      parsed.searchParams.delete("resize");
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export function normalizePlayerNameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&#\d+;|&[a-z]+;/gi, "")
    .replace(/[^a-z0-9]+/g, "");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Build playerId → headshot URL from WordPress `wpbl_player` posts.
 * Soft-fails to an empty map on network/parse errors.
 */
export async function fetchWpblHeadshotMap(options?: {
  ttlMs?: number;
}): Promise<Map<string, string>> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  if (mapCache && mapCache.expiresAt > Date.now()) {
    return mapCache.value;
  }

  try {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 20) {
      const url = `${WP_PLAYER_API}?per_page=20&page=${page}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "desk-display-backend/wpbl-headshots",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`WP players ${response.status}`);
      }
      totalPages = Number(response.headers.get("X-WP-TotalPages") ?? "1") || 1;
      const posts = (await response.json()) as WpPlayerPost[];
      if (!Array.isArray(posts) || posts.length === 0) break;

      for (const post of posts) {
        const acf = post.acf ?? {};
        const headshotUrl = extractHeadshotUrlFromAcf(acf.headshot);
        if (!headshotUrl) continue;

        const statsId = acfPlainValue(acf.stats_player_id);
        if (statsId) {
          byId.set(statsId, headshotUrl);
        }

        const first = acfPlainValue(acf.first_name);
        const last = acfPlainValue(acf.last_name);
        const title = decodeHtmlEntities(post.title?.rendered ?? "");
        const composed = `${first} ${last}`.trim() || title;
        if (composed) {
          byName.set(normalizePlayerNameKey(composed), headshotUrl);
        }
        if (title) {
          byName.set(normalizePlayerNameKey(title), headshotUrl);
        }
      }

      page += 1;
    }

    // Attach name→url under a reserved prefix so callers can resolve by name.
    const combined = new Map<string, string>(byId);
    for (const [nameKey, url] of byName) {
      combined.set(`name:${nameKey}`, url);
    }

    mapCache = { expiresAt: Date.now() + ttlMs, value: combined };
    return combined;
  } catch {
    const empty = new Map<string, string>();
    // Brief negative cache so a flaky WP does not hammer every leaders refresh.
    mapCache = { expiresAt: Date.now() + 60_000, value: empty };
    return empty;
  }
}

export function resolvePlayerHeadshot(options: {
  playerId: string;
  name: string;
  rosterHeadshotUrl?: string | null;
  headshotMap: Map<string, string>;
}): string | null {
  const roster = options.rosterHeadshotUrl?.trim();
  if (roster) return normalizeHeadshotUrl(roster);

  const byId = options.headshotMap.get(options.playerId);
  if (byId) return byId;

  const byName = options.headshotMap.get(
    `name:${normalizePlayerNameKey(options.name)}`,
  );
  return byName ?? null;
}

/** Test helper — clear in-memory cache between cases. */
export function clearWpblHeadshotCache(): void {
  mapCache = null;
}
