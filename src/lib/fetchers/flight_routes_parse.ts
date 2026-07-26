/**
 * Parse airport_codes from VRS standing-data (`KDFW-LSZH`).
 * Exported for tests via flight_routes helpers.
 */
export function parseAirportCodes(codes: string | null | undefined): {
  originIcao: string | null;
  arrivalIcao: string | null;
} {
  if (!codes || codes === "unknown") {
    return { originIcao: null, arrivalIcao: null };
  }
  const parts = codes
    .split("-")
    .map((p) => p.trim().toUpperCase())
    .filter((p) => /^[A-Z0-9]{3,4}$/.test(p));
  if (parts.length === 0) {
    return { originIcao: null, arrivalIcao: null };
  }
  return {
    originIcao: parts[0] ?? null,
    arrivalIcao: parts[parts.length - 1] ?? null,
  };
}
