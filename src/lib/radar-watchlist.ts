import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";

/**
 * Dayton-area CareFlight + Medflight registrations — mirrors firmware
 * `kRadarInterestingRegsDefault` in aircraft_notable.hpp.
 */
export const RADAR_INTERESTING_REGS_DEFAULT = [
  // CareFlight
  "N730CF",
  "N841CF",
  "N520CF",
  "N3842",
  "N164CF",
  "N942CF",
  "N625CF",
  // Medflight
  "N130HB",
  "N130JV",
  "N130KH",
  "N130MU",
  "N130NB",
] as const;

const REG_PATTERN = /^[A-Z0-9-]{2,12}$/;

/** Trim, uppercase, dedupe; drop invalid entries. */
export function normalizeWatchlistRegs(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const id = raw.trim().toUpperCase().replace(/\s+/g, "");
    if (!REG_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isValidWatchlistReg(value: string): boolean {
  return REG_PATTERN.test(value.trim().toUpperCase().replace(/\s+/g, ""));
}

/**
 * Load shared watchlist from Redis. Seeds defaults on first miss.
 * Empty array is a valid saved state and is not re-seeded.
 */
export async function getRadarWatchlist(): Promise<string[]> {
  const redis = getRedis();
  const raw = await redis.get(REDIS_KEYS.radarInterestingRegs);
  if (raw == null) {
    const seeded = [...RADAR_INTERESTING_REGS_DEFAULT];
    await redis.set(REDIS_KEYS.radarInterestingRegs, seeded);
    return seeded;
  }
  return normalizeWatchlistRegs(raw);
}

export async function setRadarWatchlist(regs: unknown): Promise<string[]> {
  const normalized = normalizeWatchlistRegs(regs);
  await getRedis().set(REDIS_KEYS.radarInterestingRegs, normalized);
  return normalized;
}
