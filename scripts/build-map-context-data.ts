/**
 * Offline build for radar map context static data.
 *
 * Towered airports:
 *   https://davidmegginson.github.io/ourairports-data/airports.csv
 *   https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv
 *   Fixture fallback: data/map/fixtures/*.csv
 *
 * Airspace rings (Class B/C/D):
 *   FAA NASR 28-day Class B/C/D shapefiles (authoritative):
 *   https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/
 *
 *   Default ingest uses data/map/fixtures/airspace.geojson (Dayton-area sample).
 *   Replace that file with NASR-derived GeoJSON for a full national refresh.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AIRSPACE_RINGS_PATH,
  buildAirspaceRings,
  buildHighways,
  buildToweredAirportsFromCsv,
  fetchOurAirportsCsvs,
  HIGHWAYS_PATH,
  MAP_DATA_DIR,
  TOWERED_AIRPORTS_PATH,
} from "../src/lib/fetchers/map_context";
import {
  AIRPORT_IDENTITY_PATH,
  attachPrimaryRunwayHeadings,
  buildAirportIdentityFromCsv,
  buildFrequenciesFromCsv,
  buildRunwaysFromCsv,
  FREQUENCIES_PATH,
  OURAIRPORTS_RUNWAYS_URL,
  RUNWAYS_PATH,
  type AirportFrequency,
  type AirportIdentity,
  type AirportRunway,
} from "../src/lib/fetchers/airport_detail";

async function buildRunwaysForTowered(
  toweredIcaos: Set<string>,
): Promise<{ filtered: Record<string, AirportRunway[]>; count: number }> {
  const res = await fetch(OURAIRPORTS_RUNWAYS_URL);
  if (!res.ok) {
    throw new Error(`runways csv download failed: ${res.status}`);
  }
  const csv = await res.text();
  const all = buildRunwaysFromCsv(csv);
  const filtered: Record<string, AirportRunway[]> = {};
  let count = 0;
  for (const [icao, rwys] of Object.entries(all)) {
    if (!toweredIcaos.has(icao)) continue;
    filtered[icao] = rwys;
    count += rwys.length;
  }
  await writeFile(RUNWAYS_PATH, `${JSON.stringify(filtered)}\n`, "utf8");
  return { filtered, count };
}

function buildIdentityAndFrequenciesForTowered(
  toweredIcaos: Set<string>,
  airportsCsv: string,
  frequenciesCsv: string,
): {
  identity: Record<string, AirportIdentity>;
  frequencies: Record<string, AirportFrequency[]>;
  identityCount: number;
  frequencyCount: number;
} {
  const allIdentity = buildAirportIdentityFromCsv(airportsCsv);
  const allFrequencies = buildFrequenciesFromCsv(airportsCsv, frequenciesCsv);

  const identity: Record<string, AirportIdentity> = {};
  let identityCount = 0;
  for (const [icao, info] of Object.entries(allIdentity)) {
    if (!toweredIcaos.has(icao)) continue;
    identity[icao] = info;
    identityCount++;
  }

  const frequencies: Record<string, AirportFrequency[]> = {};
  let frequencyCount = 0;
  for (const [icao, freqs] of Object.entries(allFrequencies)) {
    if (!toweredIcaos.has(icao)) continue;
    // Store raw (unfiltered) frequencies — getAirportDetail applies
    // filterOperationalFrequencies at read time.
    frequencies[icao] = freqs;
    frequencyCount += freqs.length;
  }

  return { identity, frequencies, identityCount, frequencyCount };
}

async function main() {
  await mkdir(MAP_DATA_DIR, { recursive: true });

  const [{ airportsCsv, frequenciesCsv }, rings, highways] = await Promise.all([
    fetchOurAirportsCsvs(),
    buildAirspaceRings(),
    buildHighways(),
  ]);

  const toweredRaw = buildToweredAirportsFromCsv(airportsCsv, frequenciesCsv);
  const toweredIcaos = new Set(toweredRaw.map((a) => a.icao));

  const { filtered: runwaysByIcao, count: runwayCount } =
    await buildRunwaysForTowered(toweredIcaos);
  const towered = attachPrimaryRunwayHeadings(toweredRaw, runwaysByIcao);

  const { identity, frequencies, identityCount, frequencyCount } =
    buildIdentityAndFrequenciesForTowered(
      toweredIcaos,
      airportsCsv,
      frequenciesCsv,
    );

  const toweredJson = `${JSON.stringify(towered)}\n`;
  const ringsJson = `${JSON.stringify(rings)}\n`;
  const highwaysJson = `${JSON.stringify(highways)}\n`;
  const identityJson = `${JSON.stringify(identity)}\n`;
  const frequenciesJson = `${JSON.stringify(frequencies)}\n`;

  await Promise.all([
    writeFile(TOWERED_AIRPORTS_PATH, toweredJson, "utf8"),
    writeFile(AIRSPACE_RINGS_PATH, ringsJson, "utf8"),
    writeFile(HIGHWAYS_PATH, highwaysJson, "utf8"),
    writeFile(AIRPORT_IDENTITY_PATH, identityJson, "utf8"),
    writeFile(FREQUENCIES_PATH, frequenciesJson, "utf8"),
  ]);

  const toweredKb = Math.round(Buffer.byteLength(toweredJson) / 1024);
  const ringsKb = Math.round(Buffer.byteLength(ringsJson) / 1024);
  const highwaysKb = Math.round(Buffer.byteLength(highwaysJson) / 1024);
  const identityKb = Math.round(Buffer.byteLength(identityJson) / 1024);
  const frequenciesKb = Math.round(Buffer.byteLength(frequenciesJson) / 1024);
  const withHeading = towered.filter(
    (a) => a.primaryRunwayHeadingDeg != null,
  ).length;

  console.log(`Wrote ${towered.length} towered airports to ${TOWERED_AIRPORTS_PATH}`);
  console.log(`  (${withHeading} with primary runway heading)`);
  console.log(`Wrote ${rings.length} airspace rings to ${AIRSPACE_RINGS_PATH}`);
  console.log(`Wrote ${highways.length} highways to ${HIGHWAYS_PATH}`);
  console.log(`Wrote runways for towered airports (${runwayCount} strips) to ${RUNWAYS_PATH}`);
  console.log(
    `Wrote identity for ${identityCount} towered airports to ${AIRPORT_IDENTITY_PATH}`,
  );
  console.log(
    `Wrote frequencies for ${Object.keys(frequencies).length} towered airports (${frequencyCount} entries) to ${FREQUENCIES_PATH}`,
  );
  console.log(
    `Output sizes: towered=${toweredKb} KiB, rings=${ringsKb} KiB, highways=${highwaysKb} KiB, identity=${identityKb} KiB, frequencies=${frequenciesKb} KiB (${path.relative(process.cwd(), MAP_DATA_DIR)}/)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
