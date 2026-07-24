/**
 * Offline build for radar map context static data.
 *
 * Towered airports:
 *   https://davidmegginson.github.io/ourairports-data/airports.csv
 *   https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv
 *
 * Airspace rings (Class B/C/D):
 *   Authoritative source — FAA NASR 28-day subscription Class B/C/D shapefiles:
 *   https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/
 *
 *   Build ingest reads data/map/fixtures/airspace.geojson (hand-curated B/C/D
 *   sample for Dayton metro). Replace that fixture to refresh nationally.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AIRSPACE_RINGS_PATH,
  buildAirspaceRings,
  buildToweredAirports,
  MAP_DATA_DIR,
  TOWERED_AIRPORTS_PATH,
} from "../src/lib/fetchers/map_context";

async function main() {
  await mkdir(MAP_DATA_DIR, { recursive: true });

  const [towered, rings] = await Promise.all([
    buildToweredAirports(),
    buildAirspaceRings(),
  ]);

  const toweredJson = `${JSON.stringify(towered)}\n`;
  const ringsJson = `${JSON.stringify(rings)}\n`;

  await Promise.all([
    writeFile(TOWERED_AIRPORTS_PATH, toweredJson, "utf8"),
    writeFile(AIRSPACE_RINGS_PATH, ringsJson, "utf8"),
  ]);

  const toweredKb = Math.round(Buffer.byteLength(toweredJson) / 1024);
  const ringsKb = Math.round(Buffer.byteLength(ringsJson) / 1024);

  console.log(`Wrote ${towered.length} towered airports to ${TOWERED_AIRPORTS_PATH}`);
  console.log(`Wrote ${rings.length} airspace rings to ${AIRSPACE_RINGS_PATH}`);
  console.log(
    `Output sizes: towered=${toweredKb} KiB, rings=${ringsKb} KiB (${path.relative(process.cwd(), MAP_DATA_DIR)}/)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
