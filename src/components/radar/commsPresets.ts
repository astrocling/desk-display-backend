import {
  defaultFeedForIcao,
  getFeedById,
  isCatalogIcao,
} from "@/lib/atc/feeds";

export const COMMS_PRESETS_STORAGE_KEY = "desk-display.commsPresets.v1";

export type CommsPresetEntry = {
  icao: string;
  pinned: boolean;
  session: boolean;
};

export type CommsPresetsStored = {
  pinnedIcaos: string[];
  expanded: boolean;
  lastFeedByIcao: Record<string, string>;
};

export function normalizeCatalogIcao(icao: string): string | null {
  const upper = icao.trim().toUpperCase();
  return isCatalogIcao(upper) ? upper : null;
}

export function mergeCommsEntries(
  pinnedIcaos: string[],
  sessionIcaos: string[],
): CommsPresetEntry[] {
  const pinned: string[] = [];
  const pinnedSet = new Set<string>();
  for (const raw of pinnedIcaos) {
    const icao = normalizeCatalogIcao(raw);
    if (!icao || pinnedSet.has(icao)) continue;
    pinnedSet.add(icao);
    pinned.push(icao);
  }

  const sessionSet = new Set<string>();
  for (const raw of sessionIcaos) {
    const icao = normalizeCatalogIcao(raw);
    if (icao) sessionSet.add(icao);
  }

  const entries: CommsPresetEntry[] = pinned.map((icao) => ({
    icao,
    pinned: true,
    session: sessionSet.has(icao),
  }));

  for (const icao of sessionSet) {
    if (pinnedSet.has(icao)) continue;
    entries.push({ icao, pinned: false, session: true });
  }
  return entries;
}

export function sanitizeLastFeedByIcao(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const icao = normalizeCatalogIcao(key);
    if (!icao || typeof value !== "string") continue;
    const feed = getFeedById(value);
    if (feed?.icao === icao) {
      result[icao] = feed.id;
    }
  }
  return result;
}

export function resolvedFeedIdForIcao(
  icao: string,
  lastFeedByIcao: Record<string, string>,
): string | undefined {
  const code = normalizeCatalogIcao(icao);
  if (!code) return undefined;
  const remembered = lastFeedByIcao[code];
  if (remembered) {
    const feed = getFeedById(remembered);
    if (feed?.icao === code) return feed.id;
  }
  return defaultFeedForIcao(code)?.id;
}

export function parseCommsPresetsStored(raw: string | null): CommsPresetsStored {
  if (raw == null || raw === "") {
    return { pinnedIcaos: [], expanded: false, lastFeedByIcao: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CommsPresetsStored> & {
      lastFeedByIcao?: unknown;
    };
    const pinnedIcaos = Array.isArray(parsed.pinnedIcaos)
      ? parsed.pinnedIcaos
          .map((x) => normalizeCatalogIcao(String(x)))
          .filter((x): x is string => x != null)
      : [];
    // dedupe preserving order
    const seen = new Set<string>();
    const unique = pinnedIcaos.filter((icao) => {
      if (seen.has(icao)) return false;
      seen.add(icao);
      return true;
    });
    return {
      pinnedIcaos: unique,
      expanded: parsed.expanded === true,
      lastFeedByIcao: sanitizeLastFeedByIcao(parsed.lastFeedByIcao),
    };
  } catch {
    return { pinnedIcaos: [], expanded: false, lastFeedByIcao: {} };
  }
}

export function serializeCommsPresetsStored(data: CommsPresetsStored): string {
  const pinnedIcaos = mergeCommsEntries(data.pinnedIcaos, []).map((e) => e.icao);
  return JSON.stringify({
    pinnedIcaos,
    expanded: data.expanded === true,
    lastFeedByIcao: sanitizeLastFeedByIcao(data.lastFeedByIcao),
  });
}
