const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active";

const SEVERITY_RANK: Record<string, number> = {
  Extreme: 5,
  Severe: 4,
  Moderate: 3,
  Minor: 2,
  Unknown: 1,
};

export interface NwsAlert {
  severity: string;
  headline: string;
}

interface NwsFeature {
  properties?: {
    severity?: string;
    headline?: string;
  };
}

interface NwsAlertsResponse {
  features?: NwsFeature[];
}

function getUserAgent(): string {
  return process.env.NWS_USER_AGENT ?? "desk-display-backend";
}

function severityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 0;
}

export function pickHighestSeverityAlert(
  features: NwsFeature[],
): NwsAlert | null {
  let best: NwsAlert | null = null;
  let bestRank = -1;

  for (const feature of features) {
    const severity = feature.properties?.severity;
    const headline = feature.properties?.headline;

    if (!severity || !headline) {
      continue;
    }

    const rank = severityRank(severity);
    if (rank > bestRank) {
      bestRank = rank;
      best = { severity, headline };
    }
  }

  return best;
}

export async function fetchNwsAlerts(
  lat: number,
  lon: number,
): Promise<NwsAlert | null> {
  const params = new URLSearchParams({
    point: `${lat},${lon}`,
  });

  const response = await fetch(`${NWS_ALERTS_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": getUserAgent(),
      Accept: "application/geo+json",
    },
  });

  if (!response.ok) {
    throw new Error(`NWS alerts request failed: ${response.status}`);
  }

  const data = (await response.json()) as NwsAlertsResponse;
  const features = data.features ?? [];

  if (features.length === 0) {
    return null;
  }

  return pickHighestSeverityAlert(features);
}
