import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
} from "@/lib/types/wpbl-display";
import { findPlayerLine, normalizePlayerName } from "@/lib/wpbl-player-match";

export { findPlayerLine, normalizePlayerName };

export function batterGameLine(line: WpblBoxPlayerLine | null): string | null {
  if (!line) return null;
  const h = line.stats.h;
  const ab = line.stats.ab;
  if (h == null || ab == null || h === "" || ab === "") return null;
  return `${h}-${ab}`;
}

/** Season batting average only — never game OBP/SLG/OPS from the boxscore. */
export function batterRateLine(line: WpblBoxPlayerLine | null): string | null {
  if (!line) return null;
  const avg = line.stats.avg;
  if (typeof avg === "string" && avg.trim()) return avg.trim();
  return null;
}

export function pitcherIpLine(line: WpblBoxPlayerLine | null): string | null {
  if (!line) return null;
  const ip = line.stats.ip;
  if (ip == null || ip === "") return null;
  return `${ip} IP`;
}

export function pitcherEraLine(line: WpblBoxPlayerLine | null): string | null {
  if (!line) return null;
  const era = line.stats.era;
  if (era == null || era === "") return null;
  return `${era} ERA`;
}

export function joinStatParts(parts: Array<string | null>): string | null {
  const filtered = parts.filter((p): p is string => Boolean(p));
  return filtered.length ? filtered.join(" · ") : null;
}

export type LiveKeyPlayers = {
  pitcherName: string | null;
  pitcherId: string | null;
  pitcherTeamAbbr: string | null;
  pitcherStats: string | null;
  batterName: string | null;
  batterId: string | null;
  batterTeamAbbr: string | null;
  batterStats: string | null;
};

export function keyPlayersFromDetail(
  detail: WpblGameDetailResponse,
): LiveKeyPlayers {
  const sit = detail.game.situation;
  const half = sit?.half;
  const battingSide: "away" | "home" | null =
    half === "top" ? "away" : half === "bottom" ? "home" : null;
  const pitchingSide: "away" | "home" | null =
    half === "top" ? "home" : half === "bottom" ? "away" : null;

  const pitcherLine = findPlayerLine(
    detail.boxscore.pitching,
    sit?.pitcherName,
  );
  const batterLine = findPlayerLine(detail.boxscore.batting, sit?.batterName);

  return {
    pitcherName: sit?.pitcherName ?? null,
    pitcherId: pitcherLine?.playerId ?? null,
    pitcherTeamAbbr:
      pitchingSide === "away"
        ? detail.game.awayAbbr
        : pitchingSide === "home"
          ? detail.game.homeAbbr
          : (pitcherLine?.side === "away"
              ? detail.game.awayAbbr
              : pitcherLine?.side === "home"
                ? detail.game.homeAbbr
                : null),
    pitcherStats: joinStatParts([
      pitcherIpLine(pitcherLine),
      pitcherEraLine(pitcherLine),
    ]),
    batterName: sit?.batterName ?? null,
    batterId: batterLine?.playerId ?? null,
    batterTeamAbbr:
      battingSide === "away"
        ? detail.game.awayAbbr
        : battingSide === "home"
          ? detail.game.homeAbbr
          : (batterLine?.side === "away"
              ? detail.game.awayAbbr
              : batterLine?.side === "home"
                ? detail.game.homeAbbr
                : null),
    batterStats: joinStatParts([
      batterGameLine(batterLine),
      batterRateLine(batterLine),
    ]),
  };
}
