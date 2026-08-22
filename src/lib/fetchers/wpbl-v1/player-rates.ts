/** Display AVG/OBP/SLG like leaders (drop leading zero: ".312"). */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return ".000";
  const fixed = value.toFixed(3);
  return fixed.startsWith("0") ? fixed.slice(1) : fixed;
}

export function formatEra(era: number): string {
  if (!Number.isFinite(era)) return "—";
  return era.toFixed(2);
}

export function formatWhip(whip: number): string {
  if (!Number.isFinite(whip)) return "—";
  return whip.toFixed(2);
}

export function formatFieldingPct(fpct: number): string {
  if (!Number.isFinite(fpct)) return "—";
  return formatRate(fpct);
}

/** Convert outs pitched to baseball IP string (e.g. 31 → "10.1"). */
export function outsToIp(outs: number): string {
  if (!Number.isFinite(outs) || outs <= 0) return "0.0";
  const whole = Math.floor(outs / 3);
  const rem = outs % 3;
  return `${whole}.${rem}`;
}

/** Parse "10.1" / "10.0" style IP into outs. */
export function ipToOuts(ip: string | number | null | undefined): number {
  if (ip == null || ip === "") return 0;
  if (typeof ip === "number") {
    if (!Number.isFinite(ip) || ip <= 0) return 0;
    const whole = Math.floor(ip);
    const frac = Math.round((ip - whole) * 10);
    return whole * 3 + (frac >= 2 ? 2 : frac);
  }
  const trimmed = String(ip).trim();
  const match = trimmed.match(/^(\d+)(?:\.(\d))?$/);
  if (!match) return 0;
  const whole = Number(match[1]);
  const rem = match[2] != null ? Number(match[2]) : 0;
  return whole * 3 + (rem >= 2 ? 2 : rem);
}

export function computeAvg(hits: number, atBats: number): string | null {
  if (atBats <= 0) return null;
  return formatRate(hits / atBats);
}

export function computeObp(options: {
  hits: number;
  walks: number;
  hbp: number;
  atBats: number;
  sf: number;
}): string | null {
  const denom =
    options.atBats + options.walks + options.hbp + options.sf;
  if (denom <= 0) return null;
  return formatRate(
    (options.hits + options.walks + options.hbp) / denom,
  );
}

export function totalBasesFromHits(options: {
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  totalBases?: number;
}): number {
  if (options.totalBases != null && options.totalBases > 0) {
    return options.totalBases;
  }
  const singles = Math.max(
    0,
    options.hits - options.doubles - options.triples - options.homeRuns,
  );
  return (
    singles +
    2 * options.doubles +
    3 * options.triples +
    4 * options.homeRuns
  );
}

export function computeSlg(options: {
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  atBats: number;
  totalBases?: number;
}): string | null {
  if (options.atBats <= 0) return null;
  const tb = totalBasesFromHits(options);
  return formatRate(tb / options.atBats);
}

export function computeOps(obp: string | null, slg: string | null): string | null {
  if (obp == null || slg == null) return null;
  const obpN = Number(obp.startsWith(".") ? `0${obp}` : obp);
  const slgN = Number(slg.startsWith(".") ? `0${slg}` : slg);
  if (!Number.isFinite(obpN) || !Number.isFinite(slgN)) return null;
  return formatRate(obpN + slgN);
}

export function computeWhip(
  hits: number,
  walks: number,
  outsPitched: number,
): string | null {
  if (outsPitched <= 0) return null;
  const ip = outsPitched / 3;
  return formatWhip((hits + walks) / ip);
}
