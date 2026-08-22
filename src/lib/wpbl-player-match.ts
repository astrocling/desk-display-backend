import type { WpblBoxPlayerLine } from "@/lib/types/wpbl-display";

/** Normalize names for loose matching (short vs full). */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical first-last key so TrackMan "Last, First" matches play-feed "First Last".
 */
export function playerNameKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    return normalizePlayerName(`${rest.join(" ")} ${last ?? ""}`);
  }
  return normalizePlayerName(trimmed);
}

/** True when names refer to the same player (handles Last, First vs First Last). */
export function playerNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const ka = playerNameKey(a);
  const kb = playerNameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const aLast = ka.split(" ").at(-1);
  const bLast = kb.split(" ").at(-1);
  return Boolean(aLast && aLast === bLast && aLast.length > 2);
}

/** Prefer exact match, then last-token / substring matches. */
export function findPlayerLine(
  lines: WpblBoxPlayerLine[],
  name: string | null | undefined,
): WpblBoxPlayerLine | null {
  if (!name?.trim()) return null;
  const needle = normalizePlayerName(name);
  if (!needle) return null;

  const needleKey = playerNameKey(name);
  const exact = lines.find(
    (line) =>
      normalizePlayerName(line.name) === needle ||
      playerNameKey(line.name) === needleKey,
  );
  if (exact) return exact;

  const needleParts = needleKey.split(" ");
  const needleLast = needleParts[needleParts.length - 1] ?? needleKey;

  const byLast = lines.find((line) => {
    const parts = playerNameKey(line.name).split(" ");
    return parts[parts.length - 1] === needleLast;
  });
  if (byLast) return byLast;

  return (
    lines.find((line) => {
      const hay = playerNameKey(line.name);
      return hay.includes(needleKey) || needleKey.includes(hay);
    }) ?? null
  );
}

/** Resolve a display name to a stats player id via boxscore lines. */
export function resolvePlayerId(
  lines: WpblBoxPlayerLine[],
  name: string | null | undefined,
): string | null {
  return findPlayerLine(lines, name)?.playerId ?? null;
}

/** Search batting then pitching (runners / two-way). */
export function resolvePlayerIdFromBox(
  batting: WpblBoxPlayerLine[],
  pitching: WpblBoxPlayerLine[],
  name: string | null | undefined,
): string | null {
  return (
    resolvePlayerId(batting, name) ?? resolvePlayerId(pitching, name)
  );
}
