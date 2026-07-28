import { haversineMiles } from "./geo";

export type IdentAircraft = {
  hex: string;
  callsign: string;
  squawk: string;
  lat: number;
  lon: number;
};

export type IdentCenter = { lat: number; lon: number };

export function normalizeIdentQuery(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function paddedSquawkDigits(queryDigits: string): string {
  if (!queryDigits) return "";
  if (queryDigits.length >= 4) return queryDigits;
  return queryDigits.padStart(4, "0");
}

function isExactSquawkQuery(qDigits: string): boolean {
  if (qDigits.length === 4 || qDigits.length <= 2) return true;
  return qDigits.length === 3 && qDigits.startsWith("0");
}

export function isExactSquawkMatch(
  ac: IdentAircraft,
  query: string,
): boolean {
  const qDigits = digitsOnly(normalizeIdentQuery(query));
  if (!qDigits || !isExactSquawkQuery(qDigits)) return false;
  const squawkDigits = digitsOnly(ac.squawk);
  if (!squawkDigits) return false;
  return squawkDigits === paddedSquawkDigits(qDigits);
}

export function aircraftMatchesIdent(
  ac: IdentAircraft,
  query: string,
): boolean {
  const q = normalizeIdentQuery(query);
  if (!q) return false;

  const cs = normalizeIdentQuery(ac.callsign);
  if (cs.includes(q)) return true;

  const qDigits = digitsOnly(q);
  if (!qDigits) return false;
  const squawkDigits = digitsOnly(ac.squawk);
  return squawkDigits.includes(qDigits);
}

export function pickBestIdentMatch<T extends IdentAircraft>(
  matches: T[],
  center: IdentCenter,
  query: string,
): T | null {
  if (matches.length === 0) return null;

  const exact = matches.filter((m) => isExactSquawkMatch(m, query));
  const pool = exact.length > 0 ? exact : matches;

  let best: T | null = null;
  let bestDist = Infinity;
  for (const m of pool) {
    const d = haversineMiles(center.lat, center.lon, m.lat, m.lon);
    if (
      !best ||
      d < bestDist - 1e-9 ||
      (Math.abs(d - bestDist) <= 1e-9 && m.hex < best.hex)
    ) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}
