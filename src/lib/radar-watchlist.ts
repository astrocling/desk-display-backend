import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";

export type WatchlistColor = "default" | "amber" | "alert" | "green" | "violet";

export type WatchlistEntry = {
  id: string;
  note?: string;
  color?: WatchlistColor;
};

export const WATCHLIST_COLORS: readonly WatchlistColor[] = [
  "default",
  "amber",
  "alert",
  "green",
  "violet",
] as const;

/**
 * Dayton-area CareFlight + Medflight registrations — mirrors firmware
 * `kRadarInterestingRegsDefault` in aircraft_notable.hpp.
 */
export const RADAR_INTERESTING_ENTRIES_DEFAULT: readonly WatchlistEntry[] = [
  { id: "N730CF", note: "CAREFLT1" },
  { id: "N841CF", note: "CAREFLT1" },
  { id: "N520CF", note: "CAREFLT2" },
  { id: "N3842", note: "CAREFLT2" },
  { id: "N164CF", note: "CAREFLT3" },
  { id: "N942CF", note: "CAREFLT4" },
  { id: "N625CF", note: "CAREFLT4" },
  { id: "N130HB", note: "MEDFLT1" },
  { id: "N130JV", note: "MEDFLT2" },
  { id: "N130KH", note: "MEDFLT3" },
  { id: "N130MU", note: "MEDFLT6" },
  { id: "N130NB", note: "MEDFLT9" },
] as const;

export const RADAR_INTERESTING_REGS_DEFAULT = RADAR_INTERESTING_ENTRIES_DEFAULT.map(
  (e) => e.id,
);

const REG_PATTERN = /^[A-Z0-9-]{2,12}$/;
const NOTE_MAX = 12;

export function normalizeWatchlistNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const note = raw.trim().toUpperCase().replace(/\s+/g, "").slice(0, NOTE_MAX);
  return note.length > 0 ? note : undefined;
}

export function parseWatchlistColor(raw: unknown): WatchlistColor | undefined {
  if (typeof raw !== "string") return undefined;
  if (!(WATCHLIST_COLORS as readonly string[]).includes(raw)) return undefined;
  if (raw === "default") return undefined;
  return raw as WatchlistColor;
}

function normalizeRegId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toUpperCase().replace(/\s+/g, "");
  return REG_PATTERN.test(id) ? id : null;
}

/** Trim/uppercase ids, migrate legacy strings, dedupe; drop invalid entries. */
export function normalizeWatchlistEntries(input: unknown): WatchlistEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const out: WatchlistEntry[] = [];

  for (const raw of input) {
    let id: string | null = null;
    let note: string | undefined;
    let color: WatchlistColor | undefined;

    if (typeof raw === "string") {
      id = normalizeRegId(raw);
    } else if (raw && typeof raw === "object" && "id" in raw) {
      const obj = raw as { id: unknown; note?: unknown; color?: unknown };
      id = normalizeRegId(obj.id);
      note = normalizeWatchlistNote(obj.note);
      color = parseWatchlistColor(obj.color);
    } else {
      continue;
    }

    if (!id || seen.has(id)) continue;
    seen.add(id);

    const entry: WatchlistEntry = { id };
    if (note) entry.note = note;
    if (color) entry.color = color;
    out.push(entry);
  }

  return out;
}

/** Thin wrapper for callers that only need registration ids. */
export function normalizeWatchlistRegs(input: unknown): string[] {
  return normalizeWatchlistEntries(input).map((e) => e.id);
}

export function isValidWatchlistReg(value: string): boolean {
  return REG_PATTERN.test(value.trim().toUpperCase().replace(/\s+/g, ""));
}

/**
 * Load shared watchlist from Redis. Seeds defaults on first miss.
 * Empty array is a valid saved state and is not re-seeded.
 */
export async function getRadarWatchlist(): Promise<WatchlistEntry[]> {
  const redis = getRedis();
  const raw = await redis.get(REDIS_KEYS.radarInterestingRegs);
  if (raw == null) {
    const seeded = RADAR_INTERESTING_ENTRIES_DEFAULT.map((e) => ({ ...e }));
    await redis.set(REDIS_KEYS.radarInterestingRegs, seeded);
    return seeded;
  }
  return normalizeWatchlistEntries(raw);
}

export async function setRadarWatchlist(
  entries: unknown,
): Promise<WatchlistEntry[]> {
  const normalized = normalizeWatchlistEntries(entries);
  await getRedis().set(REDIS_KEYS.radarInterestingRegs, normalized);
  return normalized;
}
