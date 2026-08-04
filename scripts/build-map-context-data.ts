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
 *   Committed data/map/airspace-rings.json is the national bake (preferred).
 *   data/map/fixtures/airspace.geojson is only a tiny Dayton sample for tests —
 *   buildAirspaceRings keeps the national JSON when present (>100 rings).
 *
 * ARTCC / APP-DEP boundaries:
 *   Fixture GeoJSON in data/map/fixtures/artcc.geojson and app-dep.geojson.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AIRPORTS_CATALOG_PATH,
  AIRPORT_DESIGNATORS_PATH,
  AIRSPACE_RINGS_PATH,
  APP_DEP_BOUNDARIES_PATH,
  ARTCC_BOUNDARIES_PATH,
  buildAirportCatalogFromCsv,
  buildAirspaceRings,
  buildArtccBoundaries,
  buildAppDepBoundaries,
  buildDesignatorIndex,
  buildHighways,
  buildLocalCodesByIdentFromCsv,
  buildToweredAirportsFromCsv,
  fetchOurAirportsCsvs,
  fetchOurAirportsRunwaysCsv,
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
  RUNWAYS_PATH,
  type AirportFrequency,
  type AirportIdentity,
  type AirportRunway,
} from "../src/lib/fetchers/airport_detail";

async function buildRunwaysForTowered(
  toweredIcaos: Set<string>,
  runwaysCsv: string,
): Promise<{ filtered: Record<string, AirportRunway[]>; count: number }> {
  const all = buildRunwaysFromCsv(runwaysCsv);
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

  const [
    { airportsCsv, frequenciesCsv },
    runwaysCsv,
    rings,
    highways,
    artcc,
    appDep,
  ] = await Promise.all([
    fetchOurAirportsCsvs(),
    fetchOurAirportsRunwaysCsv(),
    buildAirspaceRings(),
    buildHighways(),
    buildArtccBoundaries(),
    buildAppDepBoundaries(),
  ]);

  const catalog = buildAirportCatalogFromCsv(
    airportsCsv,
    frequenciesCsv,
    runwaysCsv,
  );
  const localCodesByIdent = buildLocalCodesByIdentFromCsv(airportsCsv);
  const designators = buildDesignatorIndex(catalog, localCodesByIdent);

  const toweredRaw = buildToweredAirportsFromCsv(airportsCsv, frequenciesCsv);
  const toweredIcaos = new Set(toweredRaw.map((a) => a.icao));

  const { filtered: runwaysByIcao, count: runwayCount } =
    await buildRunwaysForTowered(toweredIcaos, runwaysCsv);
  const towered = attachPrimaryRunwayHeadings(toweredRaw, runwaysByIcao);

  const { identity, frequencies, identityCount, frequencyCount } =
    buildIdentityAndFrequenciesForTowered(
      toweredIcaos,
      airportsCsv,
      frequenciesCsv,
    );

  const catalogJson = `${JSON.stringify(catalog)}\n`;
  const designatorsJson = `${JSON.stringify(designators)}\n`;
  const artccJson = `${JSON.stringify(artcc)}\n`;
  const appDepJson = `${JSON.stringify(appDep)}\n`;
  const toweredJson = `${JSON.stringify(towered)}\n`;
  const ringsJson = `${JSON.stringify(rings)}\n`;
  const highwaysJson = `${JSON.stringify(highways)}\n`;
  const identityJson = `${JSON.stringify(identity)}\n`;
  const frequenciesJson = `${JSON.stringify(frequencies)}\n`;

  await Promise.all([
    writeFile(AIRPORTS_CATALOG_PATH, catalogJson, "utf8"),
    writeFile(AIRPORT_DESIGNATORS_PATH, designatorsJson, "utf8"),
    writeFile(ARTCC_BOUNDARIES_PATH, artccJson, "utf8"),
    writeFile(APP_DEP_BOUNDARIES_PATH, appDepJson, "utf8"),
    writeFile(TOWERED_AIRPORTS_PATH, toweredJson, "utf8"),
    writeFile(AIRSPACE_RINGS_PATH, ringsJson, "utf8"),
    writeFile(HIGHWAYS_PATH, highwaysJson, "utf8"),
    writeFile(AIRPORT_IDENTITY_PATH, identityJson, "utf8"),
    writeFile(FREQUENCIES_PATH, frequenciesJson, "utf8"),
  ]);

  const catalogKb = Math.round(Buffer.byteLength(catalogJson) / 1024);
  const designatorsKb = Math.round(Buffer.byteLength(designatorsJson) / 1024);
  const artccKb = Math.round(Buffer.byteLength(artccJson) / 1024);
  const appDepKb = Math.round(Buffer.byteLength(appDepJson) / 1024);
  const toweredKb = Math.round(Buffer.byteLength(toweredJson) / 1024);
  const ringsKb = Math.round(Buffer.byteLength(ringsJson) / 1024);
  const highwaysKb = Math.round(Buffer.byteLength(highwaysJson) / 1024);
  const identityKb = Math.round(Buffer.byteLength(identityJson) / 1024);
  const frequenciesKb = Math.round(Buffer.byteLength(frequenciesJson) / 1024);
  const withHeading = towered.filter(
    (a) => a.primaryRunwayHeadingDeg != null,
  ).length;

  console.log(`Wrote ${catalog.length} airports to ${AIRPORTS_CATALOG_PATH}`);
  console.log(
    `Wrote ${Object.keys(designators).length} designator entries to ${AIRPORT_DESIGNATORS_PATH}`,
  );
  console.log(`Wrote ${artcc.length} ARTCC boundaries to ${ARTCC_BOUNDARIES_PATH}`);
  console.log(`Wrote ${appDep.length} APP/DEP boundaries to ${APP_DEP_BOUNDARIES_PATH}`);
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
    `Output sizes: catalog=${catalogKb} KiB, designators=${designatorsKb} KiB, artcc=${artccKb} KiB, appDep=${appDepKb} KiB, towered=${toweredKb} KiB, rings=${ringsKb} KiB, highways=${highwaysKb} KiB, identity=${identityKb} KiB, frequencies=${frequenciesKb} KiB (${path.relative(process.cwd(), MAP_DATA_DIR)}/)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
