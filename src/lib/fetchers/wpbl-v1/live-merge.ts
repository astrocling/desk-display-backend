import type { WpblBoxPlayerLine, WpblGameDetailResponse } from "@/lib/types/wpbl-display";
import { findPlayerLine } from "@/lib/wpbl-player-match";

import {
  formatInningLabel,
  mapWpblBoxscore,
  mapWpblLiveSituation,
  type WpblBoxscorePayload,
  type WpblBoxscoreStatus,
} from "./boxscore";
import { mapWpblStatus } from "./status";

/** Normalize HTTP `{ boxscore }` wrappers and bare WS boxscore objects. */
export function asWpblBoxscorePayload(
  raw: unknown,
): WpblBoxscorePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.boxscore && typeof obj.boxscore === "object") {
    return raw as WpblBoxscorePayload;
  }
  if ("teams" in obj || "status" in obj || "plays" in obj || "game_status" in obj) {
    return { boxscore: obj as WpblBoxscorePayload["boxscore"] };
  }
  return null;
}

function parseRuns(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/** Keep season AVG/ERA enriched on HTTP load across live WS remaps. */
export function preserveSeasonRates(
  next: WpblBoxPlayerLine[],
  prior: WpblBoxPlayerLine[],
): WpblBoxPlayerLine[] {
  if (!prior.length) return next;
  return next.map((line) => {
    const old =
      (line.playerId
        ? prior.find((p) => p.playerId && p.playerId === line.playerId)
        : null) ?? findPlayerLine(prior, line.name);
    if (!old) return line;
    const stats = { ...line.stats };
    if (old.stats.avg != null && old.stats.avg !== "") {
      stats.avg = old.stats.avg;
    }
    if (old.stats.era != null && old.stats.era !== "") {
      stats.era = old.stats.era;
    }
    return { ...line, stats };
  });
}

/**
 * Apply a full official boxscore (HTTP or WS snapshot/update) onto a detail blob.
 */
export function applyWpblLiveBoxscore(
  prior: WpblGameDetailResponse,
  raw: unknown,
): WpblGameDetailResponse {
  const payload = asWpblBoxscorePayload(raw);
  if (!payload?.boxscore) return prior;

  const status = mapWpblStatus(
    payload.boxscore.game_status ?? prior.game.status,
  );
  const boxStatus = payload.boxscore.status;
  const mapped = mapWpblBoxscore(payload, prior.game);

  const boxscore = mapped.available
    ? {
        ...mapped,
        batting: preserveSeasonRates(mapped.batting, prior.boxscore.batting),
        pitching: preserveSeasonRates(mapped.pitching, prior.boxscore.pitching),
      }
    : prior.boxscore.available
      ? {
          ...prior.boxscore,
          plays: mapped.plays.length ? mapped.plays : prior.boxscore.plays,
        }
      : mapped;

  const awayRuns = parseRuns(boxStatus?.away_runs) ?? prior.game.awayRuns;
  const homeRuns = parseRuns(boxStatus?.home_runs) ?? prior.game.homeRuns;

  return {
    updatedAt: new Date().toISOString(),
    game: {
      ...prior.game,
      status,
      awayRuns,
      homeRuns,
      inning: formatInningLabel(status, boxStatus) ?? (status === "live" ? prior.game.inning : null),
      situation: mapWpblLiveSituation(status, boxStatus),
    },
    boxscore,
  };
}

export type WpblLiveGameState = {
  status?: string;
  away_score?: number;
  home_score?: number;
  inning?: number;
  half?: string;
  outs?: number;
  balls?: number;
  strikes?: number;
  batter_name?: string;
  pitcher_name?: string;
};

/** Lightweight game_snapshot / path-update merge when a full boxscore isn't present. */
export function applyWpblLiveGameState(
  prior: WpblGameDetailResponse,
  state: WpblLiveGameState | null | undefined,
  gameStatusRaw?: string | null,
): WpblGameDetailResponse {
  if (!state && !gameStatusRaw) return prior;

  const status = mapWpblStatus(
    gameStatusRaw ?? state?.status ?? prior.game.status,
  );

  const priorSit = prior.game.situation;
  const patchStatus: WpblBoxscoreStatus = {
    inning: state?.inning ?? priorSit?.inningNumber ?? undefined,
    half: state?.half ?? priorSit?.half ?? undefined,
    outs: state?.outs ?? priorSit?.outs ?? undefined,
    balls: state?.balls ?? priorSit?.balls ?? undefined,
    strikes: state?.strikes ?? priorSit?.strikes ?? undefined,
    batter_name: state?.batter_name ?? priorSit?.batterName ?? undefined,
    pitcher_name: state?.pitcher_name ?? priorSit?.pitcherName ?? undefined,
    first_base: priorSit?.runnerFirst ?? undefined,
    second_base: priorSit?.runnerSecond ?? undefined,
    third_base: priorSit?.runnerThird ?? undefined,
    away_runs: state?.away_score ?? prior.game.awayRuns ?? undefined,
    home_runs: state?.home_score ?? prior.game.homeRuns ?? undefined,
  };

  return {
    updatedAt: new Date().toISOString(),
    game: {
      ...prior.game,
      status,
      awayRuns: parseRuns(state?.away_score) ?? prior.game.awayRuns,
      homeRuns: parseRuns(state?.home_score) ?? prior.game.homeRuns,
      inning:
        formatInningLabel(status, patchStatus) ??
        (status === "live" ? prior.game.inning : null),
      situation: mapWpblLiveSituation(status, {
        ...patchStatus,
        // Keep named runners / occupancy from the last full boxscore status.
        first_base: priorSit?.runnerFirst ?? "",
        second_base: priorSit?.runnerSecond ?? "",
        third_base: priorSit?.runnerThird ?? "",
        bases_occupied: [
          priorSit?.onFirst ? 1 : null,
          priorSit?.onSecond ? 2 : null,
          priorSit?.onThird ? 3 : null,
        ].filter((n): n is number => n != null),
      }),
    },
    boxscore: prior.boxscore,
  };
}

export type WpblLiveEnvelope =
  | { type: "subscribed" }
  | { type: "boxscore"; boxscore: unknown }
  | { type: "game_state"; state: WpblLiveGameState; gameStatus?: string | null }
  | { type: "ignored" };

/** Parse a WPBL `/v1/ws` JSON envelope into a merge action. */
export function parseWpblLiveEnvelope(raw: unknown): WpblLiveEnvelope {
  if (!raw || typeof raw !== "object") return { type: "ignored" };
  const envelope = raw as {
    type?: string;
    data?: Record<string, unknown> | null;
  };
  const type = envelope.type;
  const data = envelope.data;

  if (type === "subscribed") return { type: "subscribed" };

  if (type === "boxscore_snapshot" && data?.boxscore) {
    return { type: "boxscore", boxscore: data.boxscore };
  }
  if (type === "boxscore_updated" && data?.new_value) {
    return { type: "boxscore", boxscore: data.new_value };
  }
  if (type === "game_snapshot" && data) {
    const game = data.game as { status?: string } | undefined;
    const state = (data.state ?? {}) as WpblLiveGameState;
    return {
      type: "game_state",
      state,
      gameStatus: game?.status ?? state.status ?? null,
    };
  }
  if (data?.path) {
    const path = String(data.path);
    const value = data.new_value;
    const state: WpblLiveGameState = {};
    let gameStatus: string | null = null;
    if (path === "status") {
      gameStatus = String(value ?? "");
      state.status = gameStatus;
    } else if (path === "score.home") {
      state.home_score = Number(value || 0);
    } else if (path === "score.away") {
      state.away_score = Number(value || 0);
    } else if (path === "inning" || path === "state.inning") {
      state.inning = Number(value || 0);
    } else if (path === "half" || path === "state.half") {
      state.half = String(value ?? "");
    } else if (path === "outs" || path === "state.outs") {
      state.outs = Number(value || 0);
    } else {
      return { type: "ignored" };
    }
    return { type: "game_state", state, gameStatus };
  }

  return { type: "ignored" };
}

/** Apply a parsed live envelope onto a detail blob. */
export function applyWpblLiveEnvelope(
  prior: WpblGameDetailResponse,
  envelope: WpblLiveEnvelope,
): WpblGameDetailResponse {
  if (envelope.type === "boxscore") {
    return applyWpblLiveBoxscore(prior, envelope.boxscore);
  }
  if (envelope.type === "game_state") {
    return applyWpblLiveGameState(prior, envelope.state, envelope.gameStatus);
  }
  return prior;
}
