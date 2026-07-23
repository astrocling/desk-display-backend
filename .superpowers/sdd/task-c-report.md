# Task C Report — Timezones / Sunrise-Sunset

**Status**: DONE  
**Date**: 2026-07-23

## Summary

Implemented sunrise/sunset fetching for all `TIMEZONE_CITIES`, a cron route to refresh Redis cache, and a public read API. Vitest tests cover successful parsing, partial failures, and invalid API payloads.

## Files Created / Modified

| File | Purpose |
|------|---------|
| `src/lib/types/timezones.ts` | `CitySunriseSunset`, `TimezonesBlob` types |
| `src/lib/fetchers/sunrise.ts` | `fetchAllSunrise()` — sequential fetch from sunrise-sunset.org |
| `src/lib/fetchers/sunrise.test.ts` | Vitest tests with mocked `fetch` |
| `src/app/api/cron/timezones/route.ts` | Cron: auth → fetch → Redis `timezones` → `{ ok, cities }` |
| `src/app/api/timezones/route.ts` | Public GET from Redis; 503 if missing |
| `vitest.config.ts` | Vitest config with `@/` path alias |
| `package.json` | Added `"test": "vitest run"` script |

## API Behavior

### `GET /api/cron/timezones`

- Requires cron auth (`Authorization: Bearer <CRON_SECRET>` or `x-vercel-cron: 1`)
- Fetches sunrise/sunset for each city in `TIMEZONE_CITIES` via `https://api.sunrise-sunset.org/json?lat=...&lng=...&formatted=0`
- Stores `Record<cityId, { sunrise, sunset }>` in Redis key `timezones`
- Returns `{ ok: true, cities: <count> }` on success
- Returns 502 if all city fetches fail
- Partial failures: logs failed city IDs, still writes successful cities to Redis

### `GET /api/timezones`

- Returns cached timezone blob from Redis
- Returns 503 `{ error: "Timezones data not available" }` if cache is empty

## Redis Payload Shape

```json
{
  "America/New_York": {
    "sunrise": "2026-07-23T09:45:12+00:00",
    "sunset": "2026-07-23T00:32:18+00:00"
  },
  "America/Chicago": { "...": "..." }
}
```

Keys match IANA timezone IDs from `TIMEZONE_CITIES`. Times are UTC ISO strings from the API (`formatted=0`).

## Tests

```bash
npx vitest run src/lib/fetchers/sunrise.test.ts
# ✓ 3 passed
```

Coverage:

1. Parses sunrise/sunset for all configured cities
2. Returns partial results when one city fails (logs error, records failure)
3. Treats invalid API payloads as per-city failures

## Build Verification

```
npm run build  # ✓ success
```

Routes registered:

- `/api/cron/timezones` (dynamic)
- `/api/timezones` (dynamic)

## Notes

1. **Sequential fetch**: Cities are fetched one at a time to avoid rate limits on the free sunrise-sunset.org API.
2. **No `updatedAt`**: Redis blob is the city map only; consumers can rely on cron schedule (`0 6 * * *`) for freshness.
3. **Local time not included**: Only sunrise/sunset UTC ISO strings are cached; local-time display is a client concern using the city `id` as IANA timezone.
4. **Pre-existing weather test failure**: `src/lib/fetchers/weather.test.ts` fails due to time-dependent hourly filtering (another agent's domain); sunrise tests pass independently.

## Git

- **No commit** (per user instruction)
