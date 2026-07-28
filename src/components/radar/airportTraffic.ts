/** Live nearby traffic radius for the focused airport card (nm). Not user-configurable. */
export const AIRPORT_TRAFFIC_RADIUS_NM = 150;

export type TrafficAircraft = {
  hex: string;
  callsign: string;
  /** Ordered ICAO chain from route lookup; null/empty when unknown. */
  routeIcaos?: string[] | null;
};

export type AirportTrafficClassification = {
  inbound: TrafficAircraft[];
  outbound: TrafficAircraft[];
};

function normalizeIcao(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Classify nearby aircraft as inbound/outbound of `focusedIcao` using only the
 * route's first/last ICAO — no proximity or heading heuristics. A local
 * turnaround (first === last === focused) counts as outbound only, so an
 * aircraft is never double-counted. Aircraft with missing/empty routes are
 * skipped rather than guessed at.
 */
export function classifyAirportTraffic(
  focusedIcao: string,
  aircraft: TrafficAircraft[],
): AirportTrafficClassification {
  const focus = normalizeIcao(focusedIcao);
  const inboundByHex = new Map<string, TrafficAircraft>();
  const outboundByHex = new Map<string, TrafficAircraft>();

  for (const ac of aircraft) {
    const route = ac.routeIcaos;
    if (!route || route.length === 0) continue;
    const first = normalizeIcao(route[0] ?? "");
    const last = normalizeIcao(route[route.length - 1] ?? "");
    if (!first || !last) continue;

    if (first === focus) {
      outboundByHex.set(ac.hex, ac);
    } else if (last === focus) {
      inboundByHex.set(ac.hex, ac);
    }
  }

  return {
    inbound: Array.from(inboundByHex.values()),
    outbound: Array.from(outboundByHex.values()),
  };
}
