/**
 * Classic scope sweep math — mirrors desk_display ScreenRadar paint-on-scan.
 * Sweep angle is degrees clockwise from north; gate paints just after the beam.
 */

/** One revolution period (ms) — matches firmware kRadarSweepPeriodMs. */
export const SCOPE_SWEEP_MS = 10_000;

/** Illumination gate after a blip's bearing (degrees). */
export const SCOPE_SWEEP_GATE_DEG = 5;

/** Phosphor trail arc behind the beam (degrees) — matches LVGL kTrailArcDeg. */
export const SCOPE_TRAIL_ARC_DEG = 12;

/** Fade slices for the trail wedge. */
export const SCOPE_TRAIL_SLICES = 8;

/** Equirectangular east/north offset in statute miles. */
export function offsetMilesFromCenter(
  centerLat: number,
  centerLon: number,
  lat: number,
  lon: number,
): { eastMi: number; northMi: number } {
  const northMi = (lat - centerLat) * 69;
  const eastMi =
    (lon - centerLon) * 69 * Math.cos((centerLat * Math.PI) / 180);
  return { eastMi, northMi };
}

/** Clockwise degrees from north (atan2 east, north). */
export function bearingDegFromOffset(eastMi: number, northMi: number): number {
  let deg = (Math.atan2(eastMi, northMi) * 180) / Math.PI;
  deg = deg % 360;
  if (deg < 0) deg += 360;
  return deg;
}

export function bearingDegFromCenter(
  centerLat: number,
  centerLon: number,
  lat: number,
  lon: number,
): number {
  const { eastMi, northMi } = offsetMilesFromCenter(
    centerLat,
    centerLon,
    lat,
    lon,
  );
  return bearingDegFromOffset(eastMi, northMi);
}

/** True when the beam has just passed `bearingDeg` within the gate. */
export function inSweepGate(
  sweepDeg: number,
  bearingDeg: number,
  gateDeg: number = SCOPE_SWEEP_GATE_DEG,
): boolean {
  const after = ((sweepDeg - bearingDeg) % 360 + 360) % 360;
  return after < gateDeg;
}

/**
 * True when the clockwise sweep from `prevSweepDeg` → `sweepDeg` crossed
 * `bearingDeg` (or the live gate still covers it). Handles large frame gaps.
 */
export function crossedBySweep(
  prevSweepDeg: number | null,
  sweepDeg: number,
  bearingDeg: number,
  gateDeg: number = SCOPE_SWEEP_GATE_DEG,
): boolean {
  if (inSweepGate(sweepDeg, bearingDeg, gateDeg)) return true;
  if (prevSweepDeg == null) return false;
  const span = ((sweepDeg - prevSweepDeg) % 360 + 360) % 360;
  if (span <= 0) return false;
  const fromPrev = ((bearingDeg - prevSweepDeg) % 360 + 360) % 360;
  return fromPrev <= span;
}
