# Task F Report — Integration

**Status**: DONE  
**Date**: 2026-07-23

## Summary

Verified build and test integrity after parallel domain-agent merges. Tightened cron auth to Bearer-only, rewrote project documentation, finalized the API contract in `BACKEND_PLAN.md`, and aligned `updatedAt` across cached blobs.

## Verification

| Check | Result |
|-------|--------|
| `npm test` | 7 files, 17 tests passed |
| `npm run build` | Success |
| Routes present | health, weather, timezones, scores, airport, cron/{weather,timezones,scores,seed-airports} |
| `package.json` | No duplicate keys or merge conflicts |

## Changes Made

### Cron auth (`src/lib/cron-auth.ts`)

- Removed spoofable `x-vercel-cron: 1` fallback
- Now requires `Authorization: Bearer <CRON_SECRET>` only
- Added `src/lib/cron-auth.test.ts` (accepts valid Bearer, rejects missing/wrong/spoofed header)

### `updatedAt` consistency

| Blob | Before | After |
|------|--------|-------|
| `weather` | `updatedAt?` (always set) | `updatedAt` required in type |
| `scores` | `updatedAt?` (set in cron) | `updatedAt` required in type |
| `timezones` | flat city map, no timestamp | `{ updatedAt, cities }` wrapper stored in Redis |

**Breaking change for firmware**: `/api/timezones` response is now `{ updatedAt, cities: { [ianaId]: { sunrise, sunset } } }` instead of a flat city map. Documented in `BACKEND_PLAN.md`.

### Documentation

| File | Action |
|------|--------|
| `README.md` | Replaced create-next-app boilerplate with project overview, stack, env vars, local commands, smoke curls, cron Bearer auth, non-goals |
| `docs/BACKEND_PLAN.md` | Full response shapes for all public endpoints and cron routes |
| `docs/MANUAL_SETUP.md` | Bearer-only cron auth, Vercel `CRON_SECRET` auto-header note, seed-airports route, expanded verify curls |

## Route Inventory

### Public (no auth)

- `GET /api/health` → `{ ok: true }`
- `GET /api/weather` → `WeatherBlob` or 503
- `GET /api/timezones` → `TimezonesBlob` or 503
- `GET /api/scores` → `ScoresBlob` or 503
- `GET /api/airport?code=` → `{ lat, lon }` or 400/404

### Cron (Bearer required)

- `GET /api/cron/weather` — schedule `*/20 * * * *`
- `GET /api/cron/timezones` — schedule `0 6 * * *`
- `GET /api/cron/scores` — schedule `*/15 * * * *`
- `GET /api/cron/seed-airports` — manual only (not in `vercel.json`)

## Env fail-fast

`getRequiredEnv()` in `src/lib/config.ts` throws `Missing required environment variable: <NAME>` when unset. Used by `getConfig()` and `getRedis()`. No code changes needed.

## Not Changed

- No git commit (per instruction)
- Airport endpoint returns coordinates only (no blob-level `updatedAt`; per-lookup, not a cached aggregate)
- `vercel.json` cron paths unchanged (seed-airports remains manual)

## Follow-up for Firmware

Sync `desk-display-firmware` timezone parser to expect `cities` wrapper and `updatedAt` field per `docs/BACKEND_PLAN.md`.
