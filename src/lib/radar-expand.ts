/** Offline ICAO type / airline short-name expands for the radar selection card. */

const AIRCRAFT_TYPES: Record<string, string> = {
  A319: "A319",
  A320: "A320",
  A321: "A321",
  A20N: "A320neo",
  A21N: "A321neo",
  A332: "A330-200",
  A333: "A330-300",
  A339: "A330-900",
  A359: "A350-900",
  B737: "737",
  B738: "737-800",
  B739: "737-900",
  B38M: "737 MAX 8",
  B39M: "737 MAX 9",
  B752: "757-200",
  B763: "767-300",
  B772: "777-200",
  B77W: "777-300ER",
  B788: "787-8",
  B789: "787-9",
  B78X: "787-10",
  CRJ2: "CRJ-200",
  CRJ7: "CRJ-700",
  CRJ9: "CRJ-900",
  E170: "E170",
  E175: "E175",
  E190: "E190",
  E75L: "E175",
  E75S: "E175",
  C172: "Cessna 172",
  C182: "Cessna 182",
  C208: "Caravan",
  PC12: "PC-12",
  DH8D: "Dash 8-400",
  AT72: "ATR 72",
  B350: "King Air 350",
  C56X: "Citation Excel",
  CL60: "Challenger 600",
  GLF4: "Gulfstream IV",
  GLF5: "Gulfstream V",
  GLF6: "G650",
  H60: "Black Hawk",
  EC35: "EC135",
  AS50: "AS350",
};

/** Short operator labels — prefer common radio / branding names. */
const AIRLINES: Record<string, string> = {
  AAL: "American",
  UAL: "United",
  DAL: "Delta",
  SWA: "Southwest",
  JBU: "JetBlue",
  ASA: "Alaska",
  FFT: "Frontier",
  NKS: "Spirit",
  SCX: "Sun Country",
  JIA: "PSA",
  ENY: "Envoy",
  RPA: "Republic",
  SKW: "SkyWest",
  ASH: "Mesa",
  PDT: "Piedmont",
  GJS: "GoJet",
  CPZ: "Compass",
  QXE: "Horizon",
  HAL: "Hawaiian",
  FDX: "FedEx",
  UPS: "UPS",
  GTI: "Atlas",
  VXP: "Viva",
  ROU: "Rouge",
  ACA: "Air Canada",
  JZA: "Jazz",
  WJA: "WestJet",
  BAW: "British",
  DLH: "Lufthansa",
  AFR: "Air France",
  KLM: "KLM",
  UAE: "Emirates",
  QTR: "Qatar",
  EJA: "NetJets",
  LXJ: "Flexjet",
  NJE: "NetJets EU",
};

export function expandAircraftType(raw: string | null | undefined): string | null {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!code) return null;
  return AIRCRAFT_TYPES[code] ?? null;
}

export function expandAirline(raw: string | null | undefined): string | null {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!code) return null;
  return AIRLINES[code] ?? null;
}

/** Prefer expanded name; fall back to raw code. */
export function labelAircraftType(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!code) return "";
  return expandAircraftType(code) ?? code;
}

export function labelAirline(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!code) return "";
  return expandAirline(code) ?? code;
}
