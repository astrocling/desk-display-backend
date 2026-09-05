import { ipToOuts } from "@/lib/fetchers/wpbl-v1/player-rates";
import type {
  WpblLeaderEntry,
  WpblLeadersResponse,
  WpblPlayerBattingSeason,
  WpblPlayerPitchingSeason,
} from "@/lib/types/wpbl-display";

/** One spoke on a spider / radar profile. */
export type WpblSpiderAxis = {
  id: string;
  /** Short label drawn on the chart (AVG, ERA, …). */
  label: string;
  /** 0–100 league percentile (higher = stronger). */
  percentile: number;
  /** Player's display value for the axis. */
  displayValue: string;
};

export type WpblSpiderProfile = {
  kind: "batting" | "pitching";
  title: string;
  /** True when the player clears the usual leaderboard qualifier. */
  qualified: boolean;
  axes: WpblSpiderAxis[];
};

export type WpblSpiderProfiles = {
  batting: WpblSpiderProfile | null;
  pitching: WpblSpiderProfile | null;
};

/**
 * Empirical percentile of `value` within `population`.
 * Midrank ties: (countLess + 0.5 * countEqual) / n * 100.
 * Pass `higherIsBetter: false` for ERA / WHIP.
 */
export function percentileRank(
  value: number,
  population: number[],
  higherIsBetter = true,
): number | null {
  if (!Number.isFinite(value) || population.length === 0) return null;
  const values = population.filter((v) => Number.isFinite(v));
  if (values.length === 0) return null;

  let less = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) less += 1;
    else if (v === value) equal += 1;
  }
  const raw = ((less + equal * 0.5) / values.length) * 100;
  const pct = higherIsBetter ? raw : 100 - raw;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Parse leaders display rates (".312", "1.93") or plain numbers. */
export function parseStatNumber(
  raw: string | number | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—") return null;
  const n = Number(trimmed.startsWith(".") ? `0${trimmed}` : trimmed);
  return Number.isFinite(n) ? n : null;
}

function boardValues(board: WpblLeaderEntry[] | undefined): number[] {
  return (board ?? [])
    .map((e) => e.sortValue)
    .filter((v) => Number.isFinite(v));
}

function axisFromBoard(options: {
  id: string;
  label: string;
  value: number | null;
  displayValue: string;
  board: WpblLeaderEntry[] | undefined;
  higherIsBetter?: boolean;
}): WpblSpiderAxis | null {
  const {
    id,
    label,
    value,
    displayValue,
    board,
    higherIsBetter = true,
  } = options;
  if (value == null || !Number.isFinite(value)) return null;
  const population = boardValues(board);
  if (population.length === 0) return null;
  const percentile = percentileRank(value, population, higherIsBetter);
  if (percentile == null) return null;
  return { id, label, percentile, displayValue };
}

/**
 * Build batting + pitching spider profiles vs the cached leaders boards.
 * Rate axes require qualifier thresholds; counting axes always try.
 * A side with fewer than 3 plottable axes is omitted.
 */
export function buildPlayerSpiderProfiles(
  season: {
    batting: WpblPlayerBattingSeason | null;
    pitching: WpblPlayerPitchingSeason | null;
  },
  leaders: WpblLeadersResponse,
): WpblSpiderProfiles {
  const battingMinAb = leaders.qualifiers.battingMinAb;
  const pitchingMinOuts = leaders.qualifiers.pitchingMinOuts;

  let batting: WpblSpiderProfile | null = null;
  if (season.batting) {
    const b = season.batting;
    const qualified = b.ab >= battingMinAb;
    const axes: WpblSpiderAxis[] = [];

    if (qualified) {
      for (const axis of [
        axisFromBoard({
          id: "avg",
          label: "AVG",
          value: parseStatNumber(b.avg),
          displayValue: b.avg ?? "—",
          board: leaders.batting.avg,
        }),
        axisFromBoard({
          id: "obp",
          label: "OBP",
          value: parseStatNumber(b.obp),
          displayValue: b.obp ?? "—",
          board: leaders.batting.obp,
        }),
        axisFromBoard({
          id: "slg",
          label: "SLG",
          value: parseStatNumber(b.slg),
          displayValue: b.slg ?? "—",
          board: leaders.batting.slg,
        }),
        axisFromBoard({
          id: "ops",
          label: "OPS",
          value: parseStatNumber(b.ops),
          displayValue: b.ops ?? "—",
          board: leaders.batting.ops,
        }),
      ]) {
        if (axis) axes.push(axis);
      }
    }

    for (const axis of [
      axisFromBoard({
        id: "hr",
        label: "HR",
        value: b.hr,
        displayValue: String(b.hr),
        board: leaders.batting.hr,
      }),
      axisFromBoard({
        id: "rbi",
        label: "RBI",
        value: b.rbi,
        displayValue: String(b.rbi),
        board: leaders.batting.rbi,
      }),
      axisFromBoard({
        id: "sb",
        label: "SB",
        value: b.sb,
        displayValue: String(b.sb),
        board: leaders.batting.sb,
      }),
    ]) {
      if (axis) axes.push(axis);
    }

    if (axes.length >= 3) {
      batting = {
        kind: "batting",
        title: "Hitting profile",
        qualified,
        axes,
      };
    }
  }

  let pitching: WpblSpiderProfile | null = null;
  if (season.pitching) {
    const p = season.pitching;
    const outs = ipToOuts(p.ip);
    const qualified = outs >= pitchingMinOuts;
    const axes: WpblSpiderAxis[] = [];

    if (qualified) {
      for (const axis of [
        axisFromBoard({
          id: "era",
          label: "ERA",
          value: parseStatNumber(p.era),
          displayValue: p.era ?? "—",
          board: leaders.pitching.era,
          higherIsBetter: false,
        }),
        axisFromBoard({
          id: "whip",
          label: "WHIP",
          value: parseStatNumber(p.whip),
          displayValue: p.whip ?? "—",
          board: leaders.pitching.whip,
          higherIsBetter: false,
        }),
      ]) {
        if (axis) axes.push(axis);
      }
    }

    for (const axis of [
      axisFromBoard({
        id: "so",
        label: "SO",
        value: p.so,
        displayValue: String(p.so),
        board: leaders.pitching.so,
      }),
      axisFromBoard({
        id: "ip",
        label: "IP",
        value: outs,
        displayValue: p.ip,
        board: leaders.pitching.ip,
      }),
      axisFromBoard({
        id: "w",
        label: "W",
        value: p.w,
        displayValue: String(p.w),
        board: leaders.pitching.w,
      }),
      axisFromBoard({
        id: "sv",
        label: "SV",
        value: p.sv,
        displayValue: String(p.sv),
        board: leaders.pitching.sv,
      }),
    ]) {
      if (axis) axes.push(axis);
    }

    if (axes.length >= 3) {
      pitching = {
        kind: "pitching",
        title: "Pitching profile",
        qualified,
        axes,
      };
    }
  }

  return { batting, pitching };
}
