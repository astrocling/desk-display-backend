export type AtcFeedRole = "twr" | "app" | "combined";

export type AtcFeed = {
  /** LiveATC mount id, e.g. "kday" */
  id: string;
  icao: string;
  label: string;
  role: AtcFeedRole;
  /** Short airport name, e.g. "Dayton Intl" */
  name: string;
};

/**
 * Curated LiveATC mounts for the Ohio/Indiana radar POC.
 * Mount IDs can drift on LiveATC — verify if a feed goes silent.
 */
export const ATC_FEEDS: AtcFeed[] = [
  {
    id: "kind9_twr",
    icao: "KIND",
    label: "Tower",
    role: "twr",
    name: "Indianapolis Intl",
  },
  {
    id: "kind9_app_dep",
    icao: "KIND",
    label: "App/Dep",
    role: "app",
    name: "Indianapolis Intl",
  },
  {
    id: "kday",
    icao: "KDAY",
    label: "Del/Gnd/Twr/App",
    role: "combined",
    name: "Dayton Intl",
  },
  {
    id: "kcmh1_twr",
    icao: "KCMH",
    label: "Tower",
    role: "twr",
    name: "John Glenn Columbus",
  },
  {
    id: "kcmh1_twr_app",
    icao: "KCMH",
    label: "Twr/App/Dep",
    role: "app",
    name: "John Glenn Columbus",
  },
  {
    id: "kcvg1_twr",
    icao: "KCVG",
    label: "Tower",
    role: "twr",
    name: "Cincinnati/Northern Kentucky",
  },
];

function normalizeIcao(icao: string): string {
  return icao.trim().toUpperCase();
}

export function feedsForIcao(icao: string): AtcFeed[] {
  const code = normalizeIcao(icao);
  return ATC_FEEDS.filter((f) => f.icao === code);
}

export function getFeedById(id: string): AtcFeed | undefined {
  return ATC_FEEDS.find((f) => f.id === id);
}

export function catalogIcaos(): string[] {
  return [...new Set(ATC_FEEDS.map((f) => f.icao))].sort();
}

export function isCatalogIcao(icao: string): boolean {
  const code = normalizeIcao(icao);
  return ATC_FEEDS.some((f) => f.icao === code);
}

/**
 * Prefer combined when present (KDAY), else tower, else first feed.
 */
export function defaultFeedForIcao(icao: string): AtcFeed | undefined {
  const feeds = feedsForIcao(icao);
  if (feeds.length === 0) return undefined;
  return (
    feeds.find((f) => f.role === "combined") ??
    feeds.find((f) => f.role === "twr") ??
    feeds[0]
  );
}

/** External LiveATC page (opens in a new tab — not embeddable). */
export function liveAtcListenUrl(feedId: string): string {
  return `https://www.liveatc.net/hlisten.php?mount=${encodeURIComponent(feedId)}`;
}

export function liveAtcPlsUrl(feedId: string): string {
  return `https://www.liveatc.net/play/${encodeURIComponent(feedId)}.pls`;
}

/** HTTPS Icecast mounts that allow browser CORS playback. */
const LIVEATC_STREAM_HOSTS = [
  "https://s1-fmt2.liveatc.net",
  "https://s1-bos.liveatc.net",
] as const;

export function liveAtcStreamUrls(feedId: string): string[] {
  const mount = encodeURIComponent(feedId);
  return LIVEATC_STREAM_HOSTS.map((host) => `${host}/${mount}`);
}

export function liveAtcStreamUrl(feedId: string): string {
  return liveAtcStreamUrls(feedId)[0]!;
}
