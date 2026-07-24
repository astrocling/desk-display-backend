/**
 * Offline build for radar map context static data.
 *
 * Towered airports:
 *   https://davidmegginson.github.io/ourairports-data/airports.csv
 *   https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv
 *
 * Airspace rings (Class B/C/D — every altitude shelf):
 *   @squawk/airspace-data (FAA NASR-derived GeoJSON). Fixture fallback:
 *   data/map/fixtures/airspace.geojson
 *
 * Interstates:
 *   National Transportation Atlas via ArcGIS FeatureServer (ROUTE_NUM).
 *   Fixture fallback: data/map/fixtures/highways.geojson
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

  const toweredKb = Math.round(Buffer.byteLength(toweredJson) / 1024);
  const ringsKb = Math.round(Buffer.byteLength(ringsJson) / 1024);
  const highwaysKb = Math.round(Buffer.byteLength(highwaysJson) / 1024);

  console.log(`Wrote ${towered.length} towered airports to ${TOWERED_AIRPORTS_PATH}`);
  console.log(`Wrote ${rings.length} airspace rings to ${AIRSPACE_RINGS_PATH}`);
  console.log(`Wrote ${highways.length} highway polylines to ${HIGHWAYS_PATH}`);
  console.log(
    `Output sizes: towered=${toweredKb} KiB, rings=${ringsKb} KiB, highways=${highwaysKb} KiB (${path.relative(process.cwd(), MAP_DATA_DIR)}/)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
