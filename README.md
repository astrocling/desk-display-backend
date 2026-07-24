# desk-display-backend

Backend for a physical **desk display**: scheduled jobs pull weather, sunrise/sunset, sports scores, and airport coordinates into Redis, then expose simple JSON APIs for the companion `desk-display-firmware` device to poll.

```
Upstream APIs  →  Vercel Cron (/api/cron/*)  →  Upstash Redis  →  Public GET APIs  →  Firmware
```

Read endpoints return whatever is in cache. Until a cron has run successfully, they respond with **503**.

## Stack

| Piece | Role |
|-------|------|
| **Next.js** (App Router, TypeScript) | Hosted on Vercel |
| **Vercel Cron** | Refreshes caches on a schedule |
| **Upstash Redis** | Stores `weather`, `timezones`, `scores`, `airports` blobs |
| **Neon Postgres** (read-only, optional) | Flagstand race data from the SSR Hub DB |

## What it serves

| Data | Source | Cache refresh |
|------|--------|---------------|
| Home weather + NWS alerts | Open-Meteo, National Weather Service | every 20 minutes |
| Sunrise / sunset by city | sunrise-sunset.org | daily at 06:00 UTC |
| MLB + Flagstand scores | MLB Stats API, Neon (Flagstand) | every 15 minutes |
| Airport lat/lon by ICAO | OurAirports (seeded once) | manual / seed cron |
| Radar map context (towered + B/C/D rings) | Committed `data/map/*.json` (+ optional Redis seed) | build script / manual seed |

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in required vars
npm run dev                  # http://localhost:3000
npm test
```

Seed airports into Redis (needs Upstash credentials):

```bash
npm run seed:airports
npm run build:map-context   # refresh data/map JSON (OurAirports + NASR airspace + interstates)
```

`GET /api/map/context` reads committed `data/map/*.json` (or Redis after seed). It does **not** download or simplify GIS per request. Airspace comes from `@squawk/airspace-data` (FAA NASR-derived Class B/C/D shelves); interstates from the National Transportation Atlas.
## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL` | yes | Upstash Redis REST endpoint (Vercel Marketplace sets `KV_*`) |
| `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN` | yes | Upstash Redis token |
| `CRON_SECRET` | yes | Bearer token for cron routes (Vercel injects this when set) |
| `HOME_LAT` / `HOME_LON` | yes | Home weather coordinates |
| `MLB_TEAM` | yes | MLB team abbreviation (e.g. `HOU`) |
| `HOME_ZIP` | no | Optional ZIP for reference |
| `FLAGSTAND_LEAGUE_IDS` | no | Comma-separated league UUIDs |
| `DATABASE_URL` | no | Read-only Neon pooled URL; omit to disable Flagstand |
| `NWS_USER_AGENT` | no | Contact string for NWS alerts (recommended in prod) |

Missing required vars throw at request time: `Missing required environment variable: <NAME>`.

## API

### Public (no auth)

| Route | Description |
|-------|-------------|
| `GET /api/health` | Liveness `{ "ok": true }` |
| `GET /api/weather` | Cached home weather |
| `GET /api/timezones` | Cached sunrise/sunset by IANA zone |
| `GET /api/scores` | Cached MLB + Flagstand |
| `GET /api/airport?code=` | Airport lat/lon by ICAO (e.g. `KDAY`) |
| `GET /api/map/context?lat=&lon=&radiusMi=` | Nearby towered airports + Class B/C/D shelves + interstates (long CDN cache) |

### Cron (Bearer auth)

| Route | Schedule | Description |
|-------|----------|-------------|
| `GET /api/cron/weather` | `*/20 * * * *` | Refresh weather cache |
| `GET /api/cron/timezones` | `0 6 * * *` | Refresh sunrise/sunset |
| `GET /api/cron/scores` | `*/15 * * * *` | Refresh scores |
| `GET /api/cron/seed-airports` | manual | Re-seed airport hash |
| `GET /api/cron/seed-map-context` | manual | Re-seed map towered/airspace/highway blobs from `data/map` |

Cron routes require:

```http
Authorization: Bearer <CRON_SECRET>
```

The `x-vercel-cron` header alone is **not** accepted (it is spoofable). On Vercel, setting `CRON_SECRET` makes scheduled jobs send this header automatically.

Full response shapes: [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md).

## Smoke test

```bash
HOST=http://localhost:3000   # or your Vercel URL

curl -s "$HOST/api/health"
curl -s "$HOST/api/weather"
curl -s "$HOST/api/timezones"
curl -s "$HOST/api/scores"
curl -s "$HOST/api/airport?code=KDAY"

curl -s -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/weather"
curl -s -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/timezones"
curl -s -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/scores"
curl -s -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/seed-airports"
```

Expect **503** on read APIs until the matching cron has populated Redis.

## Deploy

Production setup (GitHub → Vercel, Upstash, Neon read-only role, seed, verify): **[docs/MANUAL_SETUP.md](docs/MANUAL_SETUP.md)**.

## Non-goals

- ADS-B / live flight tracking
- App-owned Postgres, Railway, or Trigger.dev
- Hard-coded home location or team in source (env-only)
