export type AirportPreset = "towered" | "public" | "public_paved" | "all";

export const PAVED_MIN_FT = 3000;
export const PINNED_STORAGE_KEY = "radar.pinnedAirports";
export const AIRPORT_MARKER_SOFT_CAP = 400;

export type MapAirportLike = {
  icao: string;
  ident?: string;
  towered: boolean;
  publicUse: boolean;
  pavedRunwayFt: number | null;
};

export function matchesAirportPreset(
  airport: MapAirportLike,
  preset: AirportPreset,
): boolean {
  switch (preset) {
    case "towered":
      return airport.towered;
    case "public":
      return airport.publicUse;
    case "public_paved":
      return (
        airport.publicUse &&
        (airport.pavedRunwayFt ?? 0) >= PAVED_MIN_FT
      );
    case "all":
      return true;
  }
}

export function filterAirportsForDisplay(
  airports: MapAirportLike[],
  preset: AirportPreset,
  pinned: Set<string>,
): MapAirportLike[] {
  const pinnedUpper = new Set(
    [...pinned].map((d) => normalizeDesignator(d)),
  );
  return airports.filter((airport) => {
    if (matchesAirportPreset(airport, preset)) return true;
    const icao = normalizeDesignator(airport.icao);
    if (pinnedUpper.has(icao)) return true;
    if (airport.ident != null) {
      const ident = normalizeDesignator(airport.ident);
      if (pinnedUpper.has(ident)) return true;
    }
    return false;
  });
}

export function softCapAirports<T>(
  airports: T[],
  cap: number = AIRPORT_MARKER_SOFT_CAP,
  isPinned?: (airport: T) => boolean,
): { airports: T[]; capped: boolean } {
  if (!isPinned) {
    if (airports.length <= cap) {
      return { airports, capped: false };
    }
    return { airports: airports.slice(0, cap), capped: true };
  }

  const pinned: T[] = [];
  const nonPinned: T[] = [];
  for (const airport of airports) {
    if (isPinned(airport)) {
      pinned.push(airport);
    } else {
      nonPinned.push(airport);
    }
  }

  const remainingCapacity = Math.max(0, cap - pinned.length);
  const keptNonPinned = nonPinned.slice(0, remainingCapacity);
  const capped =
    airports.length > cap || keptNonPinned.length < nonPinned.length;

  return { airports: [...pinned, ...keptNonPinned], capped };
}

export function normalizeDesignator(raw: string): string {
  return raw.trim().toUpperCase();
}

export function readPinnedDesignators(
  storage: Pick<Storage, "getItem"> = localStorage,
): string[] {
  try {
    const raw = storage.getItem(PINNED_STORAGE_KEY);
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const pins: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const normalized = normalizeDesignator(item);
      if (normalized === "" || seen.has(normalized)) continue;
      seen.add(normalized);
      pins.push(normalized);
    }
    return pins;
  } catch {
    return [];
  }
}

export function writePinnedDesignators(
  pins: string[],
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pins));
}

export function addPinnedDesignator(
  pins: string[],
  raw: string,
): string[] {
  const normalized = normalizeDesignator(raw);
  if (normalized === "") return pins;
  if (pins.includes(normalized)) return pins;
  return [...pins, normalized];
}
