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
