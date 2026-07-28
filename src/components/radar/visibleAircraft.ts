import { haversineMiles } from "./geo";

export const GROUND_NEAR_MI = 6;
export const GROUND_MAX_ALT_FT = 500;

export type GroundFocus = {
  lat: number;
  lon: number;
};

export type VisibleAircraftInput = {
  onGround?: boolean;
  altFt: number | null;
  lat: number;
  lon: number;
};

/**
 * Filter map/scope traffic.
 * 1. When showGroundTargets is false, drop onGround aircraft.
 * 2. When ground focus is set, keep only surface/low targets within GROUND_NEAR_MI.
 */
export function visibleAircraftFor<T extends VisibleAircraftInput>(
  aircraft: T[],
  ground: GroundFocus | null,
  showGroundTargets: boolean,
): T[] {
  let list = aircraft;
  if (!showGroundTargets) {
    list = list.filter((ac) => ac.onGround !== true);
  }
  if (!ground) return list;
  return list.filter((ac) => {
    const low =
      ac.onGround === true ||
      (ac.altFt != null && ac.altFt < GROUND_MAX_ALT_FT);
    if (!low) return false;
    return (
      haversineMiles(ground.lat, ground.lon, ac.lat, ac.lon) <= GROUND_NEAR_MI
    );
  });
}
