import { formatWhenEt } from "@/lib/fetchers/mlb";
import type {
  WpblGame,
  WpblGameStatus,
  WpblScores,
  WpblStanding,
} from "@/lib/types/scores";

export type WpblFetchResult = WpblScores & { error?: string };

const WPBL_HOMEPAGE_URL = "https://stats.womensprobaseballleague.com/";

const TEAM_BY_FULL_NAME: Record<string, { abbr: string; name: string }> = {
  "Los Angeles Queens": { abbr: "LA", name: "Queens" },
  "New York Heights": { abbr: "NY", name: "Heights" },
  "San Francisco Firebells": { abbr: "SF", name: "Firebells" },
  "Boston Hunters": { abbr: "BOS", name: "Hunters" },
};

function etCalendarDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseUtcMeta(meta: string, now: Date): string | null {
  // e.g. "Wed, Aug 12 · 10:30 PM UTC"
  const match = meta.match(
    /([A-Za-z]+),\s+([A-Za-z]+)\s+(\d{1,2})\s*[·•]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*UTC/i,
  );
  if (!match) {
    return null;
  }

  const [, , monthName, dayStr, hourStr, minuteStr, ampm] = match;
  const months: Record<string, number> = {
    jan: 0,
    february: 1,
    feb: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  const month = months[monthName.toLowerCase()];
  if (month === undefined) {
    return null;
  }

  let hour = Number(hourStr);
  const minute = Number(minuteStr);
  const day = Number(dayStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(day)) {
    return null;
  }

  const upper = ampm.toUpperCase();
  if (upper === "PM" && hour < 12) {
    hour += 12;
  }
  if (upper === "AM" && hour === 12) {
    hour = 0;
  }

  const year = now.getUTCFullYear();
  const iso = new Date(Date.UTC(year, month, day, hour, minute, 0)).toISOString();
  return iso;
}

function badgeStatus(badgeClass: string, badgeText: string): WpblGameStatus {
  const hay = `${badgeClass} ${badgeText}`.toLowerCase();
  if (/\blive\b/.test(hay)) {
    return "live";
  }
  if (/\bfinal\b/.test(hay)) {
    return "final";
  }
  return "scheduled";
}

function parseStandings(html: string): WpblStanding[] {
  const tableMatch = html.match(
    /<table[^>]*class="[^"]*standings-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) {
    return [];
  }

  const bodyMatch = tableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const body = bodyMatch?.[1] ?? tableMatch[1];
  const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const standings: WpblStanding[] = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (m) => m[1].replace(/<[^>]+>/g, "").trim(),
    );
    if (cells.length < 7) {
      continue;
    }
    // Team, Rank, W, L, T, PCT, GB
    const team = TEAM_BY_FULL_NAME[cells[0]];
    if (!team) {
      continue;
    }
    const w = Number(cells[2]);
    const l = Number(cells[3]);
    if (!Number.isFinite(w) || !Number.isFinite(l)) {
      continue;
    }
    standings.push({
      abbr: team.abbr,
      name: team.name,
      w,
      l,
      pct: cells[5] || null,
      gb: cells[6] || null,
    });
  }

  return standings;
}

function parseGames(html: string, now: Date): WpblGame[] {
  const blocks = [
    ...html.matchAll(/<a[^>]*class="[^"]*\bgame\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi),
  ];
  const games: WpblGame[] = [];

  for (const block of blocks) {
    const inner = block[1];
    const badgeMatch = inner.match(
      /class="([^"]*\bbadge\b[^"]*)"[^>]*>([\s\S]*?)<\//i,
    );
    const teamsMatch = inner.match(
      /class="[^"]*\bteams\b[^"]*"[^>]*>([\s\S]*?)<\//i,
    );
    const metaMatch = inner.match(
      /class="[^"]*\bmeta\b[^"]*"[^>]*>([\s\S]*?)<\//i,
    );
    const scoreMatch = inner.match(
      /class="[^"]*\bscore\b[^"]*"[^>]*>([\s\S]*?)<\//i,
    );
    const inningMatch = inner.match(
      /class="[^"]*\binning\b[^"]*"[^>]*>([\s\S]*?)<\//i,
    );

    if (!teamsMatch) {
      continue;
    }

    const teamsText = teamsMatch[1].replace(/<[^>]+>/g, "").trim();
    const parts = teamsText.split(/\s+at\s+/i);
    if (parts.length !== 2) {
      continue;
    }
    const awayTeam = TEAM_BY_FULL_NAME[parts[0].trim()];
    const homeTeam = TEAM_BY_FULL_NAME[parts[1].trim()];
    if (!awayTeam || !homeTeam) {
      continue;
    }

    const status = badgeStatus(
      badgeMatch?.[1] ?? "",
      (badgeMatch?.[2] ?? "").replace(/<[^>]+>/g, "").trim(),
    );

    const metaText = (metaMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    const startIso = parseUtcMeta(metaText, now);

    let awayRuns: number | null = null;
    let homeRuns: number | null = null;
    const scoreText = (scoreMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    const scoreParts = scoreText.match(/^(\d+)\s*-\s*(\d+)/);
    if (scoreParts && status !== "scheduled") {
      awayRuns = Number(scoreParts[1]);
      homeRuns = Number(scoreParts[2]);
    }

    const inningRaw = (inningMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    const inning =
      status === "live" && inningRaw
        ? inningRaw
        : null;

    games.push({
      status,
      inning,
      awayAbbr: awayTeam.abbr,
      homeAbbr: homeTeam.abbr,
      awayName: awayTeam.name,
      homeName: homeTeam.name,
      awayRuns,
      homeRuns,
      whenEt:
        status === "scheduled" && startIso ? formatWhenEt(startIso) : null,
      startIso,
    });
  }

  return games;
}

export function parseWpblHomepageHtml(
  html: string,
  now: Date = new Date(),
): WpblScores {
  const standings = parseStandings(html);
  const allGames = parseGames(html, now);
  const todayEt = etCalendarDayKey(now);

  const filtered = allGames.filter((game) => {
    if (game.status === "live") {
      return true;
    }
    if (!game.startIso) {
      return false;
    }
    return etCalendarDayKey(new Date(game.startIso)) === todayEt;
  });

  filtered.sort((a, b) => {
    const aMs = a.startIso ? Date.parse(a.startIso) : Number.POSITIVE_INFINITY;
    const bMs = b.startIso ? Date.parse(b.startIso) : Number.POSITIVE_INFINITY;
    return aMs - bMs;
  });

  return {
    games: filtered.slice(0, 4),
    standings,
  };
}

export async function fetchWpbl(now: Date = new Date()): Promise<WpblFetchResult> {
  try {
    const response = await fetch(WPBL_HOMEPAGE_URL, {
      headers: { "Accept-Encoding": "identity" },
    });
    if (!response.ok) {
      return {
        games: [],
        standings: [],
        error: `WPBL homepage request failed: ${response.status}`,
      };
    }
    const html = await response.text();
    return parseWpblHomepageHtml(html, now);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WPBL homepage fetch failed";
    return { games: [], standings: [], error: message };
  }
}
