import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
} from "@/lib/types/wpbl-display";

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

export function batterGameLine(line: WpblBoxPlayerLine | null): string | null {
  if (!line) return null;
  const h = line.stats.h;
  const ab = line.stats.ab;
  if (h == null || ab == null || h === "" || ab === "") return null;
  return `${h}-${ab}`;
}

export function batterRateLine(line: WpblBoxPlayerLine | null): string | null {
  if (!line) return null;
  const avg = line.stats.avg;
  if (typeof avg === "string" && avg.trim()) return avg.trim();
  const obp = Number(line.stats.obp);
  const slg = Number(line.stats.slg);
  if (Number.isFinite(obp) && Number.isFinite(slg)) {
    return (obp + slg).toFixed(3).replace(/^0/, "");
  }
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
  pitcherTeamAbbr: string | null;
  pitcherStats: string | null;
  batterName: string | null;
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
