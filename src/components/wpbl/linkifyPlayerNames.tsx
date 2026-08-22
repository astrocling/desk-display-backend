import type { ReactNode } from "react";

import type { WpblBoxPlayerLine } from "@/lib/types/wpbl-display";
import { normalizePlayerName } from "@/lib/wpbl-player-match";

import { PlayerNameLink } from "./PlayerNameLink";

export type NamedPlayer = {
  name: string;
  playerId: string;
};

/** Unique named players from batting + pitching lines (longest names first). */
export function rosterFromBoxLines(
  batting: WpblBoxPlayerLine[],
  pitching: WpblBoxPlayerLine[],
): NamedPlayer[] {
  const byId = new Map<string, NamedPlayer>();
  for (const line of [...batting, ...pitching]) {
    if (!line.playerId || !line.name.trim()) continue;
    if (!byId.has(line.playerId)) {
      byId.set(line.playerId, {
        name: line.name.trim(),
        playerId: line.playerId,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.name.length - a.name.length);
}

/**
 * Replace known player names in free text with profile links.
 * Falls back to plain text when nothing matches.
 */
export function linkifyPlayerNames(
  text: string,
  roster: NamedPlayer[],
  className =
    "font-medium underline-offset-2 hover:underline hover:text-[#41B6E6]",
): ReactNode {
  if (!text || roster.length === 0) return text;

  const escaped = roster.map((p) =>
    p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (!part) return null;
    const match = roster.find(
      (p) => normalizePlayerName(p.name) === normalizePlayerName(part),
    );
    if (!match) return part;
    return (
      <PlayerNameLink
        key={`${match.playerId}-${index}`}
        playerId={match.playerId}
        name={part}
        className={className}
      />
    );
  });
}
