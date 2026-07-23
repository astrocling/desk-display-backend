import { config } from "dotenv";

import { seedAirportsToRedis } from "../src/lib/fetchers/airports";

config({ path: ".env.local" });

async function main() {
  const count = await seedAirportsToRedis();
  console.log(`Seeded ${count} airports to Redis`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
