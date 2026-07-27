/**
 * Parse airport_codes from VRS standing-data (`KDFW-KDAY-KDFW`).
 * Exported for tests via flight_routes helpers.
 */

const ICAO_RE = /^[A-Z0-9]{3,4}$/;

export function parseAirportCodeList(
  codes: string | null | undefined,
): string[] {
  if (!codes || codes === "unknown") return [];
  return codes
    .split("-")
    .map((p) => p.trim().toUpperCase())
    .filter((p) => ICAO_RE.test(p));
}

export function parseAirportCodes(codes: string | null | undefined): {
  originIcao: string | null;
  arrivalIcao: string | null;
} {
  const parts = parseAirportCodeList(codes);
  if (parts.length === 0) {
    return { originIcao: null, arrivalIcao: null };
  }
  return {
    originIcao: parts[0] ?? null,
    arrivalIcao: parts[parts.length - 1] ?? null,
  };
}

/** Pull `location` strings from `_airports` when count matches the ICAO list. */
export function parseRouteLocations(
  routeIcaos: readonly string[],
  airports: unknown,
): string[] {
  if (!Array.isArray(airports) || airports.length === 0) return [];
  if (airports.length !== routeIcaos.length) return [];

  const locations: string[] = [];
  for (let i = 0; i < airports.length; i++) {
    const row = airports[i];
    if (!row || typeof row !== "object") return [];
    const loc = (row as { location?: unknown }).location;
    if (typeof loc !== "string" || !loc.trim()) return [];
    const icao = (row as { icao?: unknown }).icao;
    if (
      typeof icao === "string" &&
      icao.trim().toUpperCase() !== routeIcaos[i]
    ) {
      return [];
    }
    locations.push(loc.trim());
  }
  return locations;
}

export function parseAirlineCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{2,3}$/.test(code) ? code : null;
}
