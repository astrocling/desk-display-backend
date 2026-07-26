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
  buildToweredAirports,
  HIGHWAYS_PATH,
  MAP_DATA_DIR,
  TOWERED_AIRPORTS_PATH,
} from "../src/lib/fetchers/map_context";
import {
  buildRunwaysFromCsv,
  OURAIRPORTS_RUNWAYS_URL,
  RUNWAYS_PATH,
} from "../src/lib/fetchers/airport_detail";

async function buildRunwaysForTowered(
  toweredIcaos: Set<string>,
): Promise<number> {
  const res = await fetch(OURAIRPORTS_RUNWAYS_URL);
  if (!res.ok) {
    throw new Error(`runways csv download failed: ${res.status}`);
  }
  const csv = await res.text();
  const all = buildRunwaysFromCsv(csv);
  const filtered: Record<string, (typeof all)[string]> = {};
  let count = 0;
  for (const [icao, rwys] of Object.entries(all)) {
    if (!toweredIcaos.has(icao)) continue;
    filtered[icao] = rwys;
    count += rwys.length;
  }
  await writeFile(RUNWAYS_PATH, `${JSON.stringify(filtered)}\n`, "utf8");
  return count;
}

async function main() {
  await mkdir(MAP_DATA_DIR, { recursive: true });

  const [towered, rings, highways] = await Promise.all([
    buildToweredAirports(),
    buildAirspaceRings(),
    buildHighways(),
  ]);

  const toweredJson = `${JSON.stringify(towered)}\n`;
  const ringsJson = `${JSON.stringify(rings)}\n`;
  const highwaysJson = `${JSON.stringify(highways)}\n`;

  await Promise.all([
    writeFile(TOWERED_AIRPORTS_PATH, toweredJson, "utf8"),
    writeFile(AIRSPACE_RINGS_PATH, ringsJson, "utf8"),
    writeFile(HIGHWAYS_PATH, highwaysJson, "utf8"),
  ]);

  const runwayCount = await buildRunwaysForTowered(
    new Set(towered.map((a) => a.icao)),
  );

  const toweredKb = Math.round(Buffer.byteLength(toweredJson) / 1024);
  const ringsKb = Math.round(Buffer.byteLength(ringsJson) / 1024);
  const highwaysKb = Math.round(Buffer.byteLength(highwaysJson) / 1024);

  console.log(`Wrote ${towered.length} towered airports to ${TOWERED_AIRPORTS_PATH}`);
  console.log(`Wrote ${rings.length} airspace rings to ${AIRSPACE_RINGS_PATH}`);
  console.log(`Wrote ${highways.length} highways to ${HIGHWAYS_PATH}`);
  console.log(`Wrote runways for towered airports (${runwayCount} strips) to ${RUNWAYS_PATH}`);
  console.log(
    `Output sizes: towered=${toweredKb} KiB, rings=${ringsKb} KiB, highways=${highwaysKb} KiB (${path.relative(process.cwd(), MAP_DATA_DIR)}/)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
