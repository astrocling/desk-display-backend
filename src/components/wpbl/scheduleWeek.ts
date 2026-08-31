import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

const ET = "America/New_York";

const WEEKDAY_OFFSET_FROM_MON: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Calendar date in America/New_York as `YYYY-MM-DD`. */
export function etYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

function weekdayShortEt(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  // Noon UTC ≈ morning/afternoon ET — weekday is stable for that calendar day.
  const probe = new Date(Date.UTC(y, m - 1, d, 16, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
  }).format(probe);
}

/** Monday (inclusive) of the ET week containing `now`. */
export function mondayOfWeekEt(now: Date = new Date()): string {
  const today = etYmd(now);
  const weekday = weekdayShortEt(today);
  const offset = WEEKDAY_OFFSET_FROM_MON[weekday] ?? 0;
  return addDaysYmd(today, -offset);
}

export function sundayOfWeekEt(now: Date = new Date()): string {
  return addDaysYmd(mondayOfWeekEt(now), 6);
}

export function gameStartYmd(game: WpblScheduleGame): string | null {
  if (!game.startIso) return null;
  const ms = new Date(game.startIso).getTime();
  if (Number.isNaN(ms)) return null;
  return etYmd(new Date(ms));
}

/**
 * Games to pin at the top of the league board for "today" (ET):
 * - any live game (even if it started yesterday ET)
 * - any game whose start calendar day is today ET
 */
export function todaysSlateGames(
  games: WpblScheduleGame[],
  now: Date = new Date(),
): WpblScheduleGame[] {
  const today = etYmd(now);
  const slate = games.filter(
    (game) => game.status === "live" || gameStartYmd(game) === today,
  );
  return [...slate].sort((a, b) => {
    const tier = (g: WpblScheduleGame) => {
      if (g.status === "live") return 0;
      if (g.status === "scheduled") return 1;
      if (g.status === "final") return 2;
      return 3;
    };
    const tA = tier(a);
    const tB = tier(b);
    if (tA !== tB) return tA - tB;
    const aMs = a.startIso ? new Date(a.startIso).getTime() : 0;
    const bMs = b.startIso ? new Date(b.startIso).getTime() : 0;
    if (tA === 2) return bMs - aMs;
    return aMs - bMs || a.id.localeCompare(b.id);
  });
}

/**
 * Final games from yesterday (ET) — shown on the home digest the morning after.
 */
export function yesterdaysFinalGames(
  games: WpblScheduleGame[],
  now: Date = new Date(),
): WpblScheduleGame[] {
  const yesterday = addDaysYmd(etYmd(now), -1);
  return games
    .filter(
      (game) =>
        game.status === "final" && gameStartYmd(game) === yesterday,
    )
    .sort((a, b) => {
      const aMs = a.startIso ? new Date(a.startIso).getTime() : 0;
      const bMs = b.startIso ? new Date(b.startIso).getTime() : 0;
      return bMs - aMs || a.id.localeCompare(b.id);
    });
}

export type ScheduleWeekPartition = {
  weekStartYmd: string;
  weekEndYmd: string;
  weekLabel: string;
  past: WpblScheduleGame[];
  thisWeek: WpblScheduleGame[];
  future: WpblScheduleGame[];
};

function formatWeekLabel(weekStartYmd: string, weekEndYmd: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
  });
  const start = new Date(`${weekStartYmd}T16:00:00Z`);
  const end = new Date(`${weekEndYmd}T16:00:00Z`);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function byStartAsc(a: WpblScheduleGame, b: WpblScheduleGame): number {
  const aMs = a.startIso ? new Date(a.startIso).getTime() : Number.MAX_SAFE_INTEGER;
  const bMs = b.startIso ? new Date(b.startIso).getTime() : Number.MAX_SAFE_INTEGER;
  if (aMs !== bMs) return aMs - bMs;
  return a.id.localeCompare(b.id);
}

function byStartDesc(a: WpblScheduleGame, b: WpblScheduleGame): number {
  return byStartAsc(b, a);
}

export const HOME_SCHEDULE_TEASER_LIMIT = 5;

/**
 * Compact home schedule rows: next upcoming games, padded with recent finals
 * when the slate is quiet. Optionally skip games already shown on today's slate.
 */
export function homeScheduleTeaserGames(
  games: WpblScheduleGame[],
  options: {
    limit?: number;
    excludeIds?: ReadonlySet<string>;
  } = {},
): WpblScheduleGame[] {
  const limit = options.limit ?? HOME_SCHEDULE_TEASER_LIMIT;
  const excludeIds = options.excludeIds;
  const rest = excludeIds
    ? games.filter((g) => !excludeIds.has(g.id))
    : games;

  const upcoming = rest
    .filter((g) => g.status === "scheduled" || g.status === "other")
    .sort(byStartAsc);

  const recentFinals = rest
    .filter((g) => g.status === "final")
    .sort(byStartDesc);

  const out: WpblScheduleGame[] = [];
  for (const game of upcoming) {
    if (out.length >= limit) break;
    out.push(game);
  }
  for (const game of recentFinals) {
    if (out.length >= limit) break;
    out.push(game);
  }

  // Quiet board with only live games excluded: still show something chronological.
  if (out.length === 0) {
    return [...rest].sort(byStartAsc).slice(0, limit);
  }

  return out;
}

/**
 * Split schedule into past / this week (Mon–Sun ET) / future.
 * Games without a usable start date go to `future` so they remain discoverable when expanded.
 */
export function partitionScheduleByWeek(
  games: WpblScheduleGame[],
  now: Date = new Date(),
): ScheduleWeekPartition {
  const weekStartYmd = mondayOfWeekEt(now);
  const weekEndYmd = addDaysYmd(weekStartYmd, 6);

  const past: WpblScheduleGame[] = [];
  const thisWeek: WpblScheduleGame[] = [];
  const future: WpblScheduleGame[] = [];

  for (const game of games) {
    const ymd = gameStartYmd(game);
    if (!ymd) {
      future.push(game);
      continue;
    }
    if (ymd < weekStartYmd) {
      past.push(game);
    } else if (ymd > weekEndYmd) {
      future.push(game);
    } else {
      thisWeek.push(game);
    }
  }

  past.sort(byStartDesc);
  thisWeek.sort(byStartAsc);
  future.sort(byStartAsc);

  return {
    weekStartYmd,
    weekEndYmd,
    weekLabel: formatWeekLabel(weekStartYmd, weekEndYmd),
    past,
    thisWeek,
    future,
  };
}
