import { formatWhenEt } from "@/lib/fetchers/mlb";
import type {
  WpblGame,
  WpblGameStatus,
  WpblScores,
} from "@/lib/types/scores";

const WPBL_HOMEPAGE_URL = "https://stats.womensprobaseballleague.com/";
const EASTERN_TIME_ZONE = "America/New_York";

const TEAMS: Record<string, { abbr: string; name: string }> = {
  "Los Angeles Queens": { abbr: "LA", name: "Queens" },
  "New York Heights": { abbr: "NY", name: "Heights" },
  "San Francisco Firebells": { abbr: "SF", name: "Firebells" },
  "Boston Hunters": { abbr: "BOS", name: "Hunters" },
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export type WpblFetchResult = WpblScores & { error?: string };

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function classContent(html: string, className: string): string | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `<([a-z][\\w:-]*)\\b[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
      "i",
    ),
  );
  return match ? decodeHtml(match[2]) : null;
}

function taggedBlocks(html: string, tagPattern: string, className: string): string[] {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<(${tagPattern})\\b[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    "gi",
  );
  return Array.from(html.matchAll(pattern), (match) => match[2]);
}

function easternDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function easternYear(date: Date): number {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
  }).format(date);
  return Number(year);
}

function parseUtcMeta(meta: string | null, year: number): string | null {
  if (!meta) return null;
  const match = meta.match(
    /(?:[A-Z][a-z]{2},\s*)?([A-Z][a-z]{2})\s+(\d{1,2})\s*·\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*UTC/i,
  );
  if (!match) return null;

  const month = MONTHS[match[1].toLowerCase()];
  if (month === undefined) return null;
  const day = Number(match[2]);
  let hour = Number(match[3]) % 12;
  if (match[5].toUpperCase() === "PM") hour += 12;
  const minute = Number(match[4]);
  const date = new Date(Date.UTC(year, month, day, hour, minute));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseStatus(block: string): WpblGameStatus | null {
  const badgeTag = block.match(
    /<[^>]*class=["'][^"']*\bbadge\b[^"']*["'][^>]*>/i,
  )?.[0];
  if (badgeTag && /\blive\b/i.test(badgeTag)) return "live";
  if (badgeTag && /\bfinal\b/i.test(badgeTag)) return "final";
  if (badgeTag && /\bscheduled\b/i.test(badgeTag)) return "scheduled";

  const badge = classContent(block, "badge");
  if (badge && /\blive\b/i.test(badge)) return "live";
  if (badge && /\bfinal\b/i.test(badge)) return "final";
  if (badge && /\b(upcoming|scheduled)\b/i.test(badge)) return "scheduled";
  return null;
}

function parseScore(score: string | null): [number | null, number | null] {
  const match = score?.match(/(\d+)\s*-\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : [null, null];
}

function parseStandings(html: string): WpblScores["standings"] {
  const table = taggedBlocks(html, "[a-z][\\w:-]*", "standings-table")[0];
  if (!table) return [];
  const body = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? table;

  return Array.from(body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((row) =>
      Array.from(row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi), (cell) =>
        decodeHtml(cell[1]),
      ),
    )
    .map((cells) => {
      const team = TEAMS[cells[0]];
      const w = Number(cells[2]);
      const l = Number(cells[3]);
      if (!team || !Number.isFinite(w) || !Number.isFinite(l)) return null;
      return {
        ...team,
        w,
        l,
        pct: cells[5] || null,
        gb: cells[6] || null,
      };
    })
    .filter((standing): standing is WpblScores["standings"][number] =>
      Boolean(standing),
    )
    .slice(0, 4);
}

function parseGames(html: string, now: Date): WpblGame[] {
  const today = easternDateKey(now);
  const year = easternYear(now);

  return taggedBlocks(html, "[a-z][\\w:-]*", "game")
    .map((block): WpblGame | null => {
      const status = parseStatus(block);
      const teams = classContent(block, "teams")?.split(/\s+at\s+/i);
      if (!status || teams?.length !== 2) return null;
      const away = TEAMS[teams[0].trim()];
      const home = TEAMS[teams[1].trim()];
      if (!away || !home) return null;

      const startIso = parseUtcMeta(classContent(block, "meta"), year);
      const [awayRuns, homeRuns] =
        status === "scheduled"
          ? [null, null]
          : parseScore(classContent(block, "score"));

      return {
        status,
        inning: status === "live" ? classContent(block, "inning") : null,
        awayAbbr: away.abbr,
        homeAbbr: home.abbr,
        awayName: away.name,
        homeName: home.name,
        awayRuns,
        homeRuns,
        whenEt: status === "scheduled" && startIso ? formatWhenEt(startIso) : null,
        startIso,
      };
    })
    .filter((game): game is WpblGame => Boolean(game))
    .filter(
      (game) =>
        game.status === "live" ||
        (game.startIso !== null &&
          easternDateKey(new Date(game.startIso)) === today),
    )
    .sort((a, b) => {
      if (a.status === "live" && b.status !== "live") return -1;
      if (a.status !== "live" && b.status === "live") return 1;
      return (
        (a.startIso ? Date.parse(a.startIso) : Number.MAX_SAFE_INTEGER) -
        (b.startIso ? Date.parse(b.startIso) : Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, 4);
}

export function parseWpblHomepageHtml(
  html: string,
  now = new Date(),
): WpblScores {
  return {
    games: parseGames(html, now),
    standings: parseStandings(html),
  };
}

export async function fetchWpbl(now = new Date()): Promise<WpblFetchResult> {
  try {
    const response = await fetch(WPBL_HOMEPAGE_URL, {
      headers: {
        Accept: "text/html",
        "Accept-Encoding": "identity",
      },
    });
    if (!response.ok) {
      throw new Error(`WPBL homepage request failed: ${response.status}`);
    }
    return parseWpblHomepageHtml(await response.text(), now);
  } catch (error) {
    return {
      games: [],
      standings: [],
      error: error instanceof Error ? error.message : "WPBL fetch failed",
    };
  }
}
