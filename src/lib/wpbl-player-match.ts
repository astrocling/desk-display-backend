import type { WpblBoxPlayerLine } from "@/lib/types/wpbl-display";

/** Normalize names for loose matching (short vs full). */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prefer exact match, then last-token / substring matches. */
export function findPlayerLine(
  lines: WpblBoxPlayerLine[],
  name: string | null | undefined,
): WpblBoxPlayerLine | null {
  if (!name?.trim()) return null;
  const needle = normalizePlayerName(name);
  if (!needle) return null;

  const exact = lines.find((line) => normalizePlayerName(line.name) === needle);
  if (exact) return exact;

  const needleParts = needle.split(" ");
  const needleLast = needleParts[needleParts.length - 1] ?? needle;

  const byLast = lines.find((line) => {
    const parts = normalizePlayerName(line.name).split(" ");
    return parts[parts.length - 1] === needleLast;
  });
  if (byLast) return byLast;

  return (
    lines.find((line) => {
      const hay = normalizePlayerName(line.name);
      return hay.includes(needle) || needle.includes(hay);
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
