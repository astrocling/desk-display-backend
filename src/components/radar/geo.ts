/** Statute miles between two WGS84 points. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(a));
}

/** Approximate visible radius (mi) from map center to NE corner. */
export function viewportRadiusMiles(
  centerLat: number,
  centerLon: number,
  north: number,
  east: number,
): number {
  return haversineMiles(centerLat, centerLon, north, east);
}

export function milesToNm(miles: number): number {
  return miles * 0.868976;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Map-context API radius band (statute miles).
 * Device radar historically capped near 50 mi for MCU/RAM limits; web can show
 * full Class B/C/D shelves across a wide viewport without that constraint.
 */
export const MAP_CONTEXT_MAX_MI = 250;
export const MAP_CONTEXT_MIN_MI = 5;

/** Community ADS-B v2 lat/lon endpoints accept 1–250 nm. */
export const ADSB_MAX_NM = 250;
export const ADSB_MIN_NM = 1;

/** Only poll ADS-B when viewport radius is within this band (nm). */
export const ADSB_VIEWPORT_MAX_NM = 250;

/** Soft ceiling matching map-context max (mi). */
export const OVERLAY_VIEWPORT_MAX_MI = 250;
