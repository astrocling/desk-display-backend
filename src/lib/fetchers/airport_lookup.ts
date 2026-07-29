import type { MapAirport } from "@/lib/fetchers/map_context";

export type AirportLookupSuccess = {
  ok: true;
  ident: string;
  icao: string;
  name: string;
};

export type AirportLookupFailure = {
  ok: false;
  error: "not_found";
};

export type AirportLookupResult = AirportLookupSuccess | AirportLookupFailure;

export function buildCatalogByIdent(
  airports: MapAirport[],
): Map<string, MapAirport> {
  const catalogByIdent = new Map<string, MapAirport>();
  for (const airport of airports) {
    catalogByIdent.set(airport.ident.toUpperCase(), airport);
  }
  return catalogByIdent;
}

export function lookupAirportByDesignator(
  q: string,
  designators: Record<string, string>,
  catalogByIdent: Map<string, MapAirport>,
): AirportLookupResult {
  const code = q.trim().toUpperCase();
  if (!code) {
    return { ok: false, error: "not_found" };
  }

  const primaryIdent = designators[code]?.trim();
  const airport =
    (primaryIdent
      ? catalogByIdent.get(primaryIdent.toUpperCase())
      : undefined) ?? catalogByIdent.get(code);

  if (!airport) {
    return { ok: false, error: "not_found" };
  }

  return {
    ok: true,
    ident: airport.ident,
    icao: airport.icao,
    name: airport.name,
  };
}
