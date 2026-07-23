# Task D Report — MLB + Flagstand Scores

**Status**: DONE  
**Date**: 2026-07-23

## Summary

Implemented MLB (ESPN) and Flagstand (Neon) score fetchers, cron writer, public GET endpoint, types, and Vitest coverage. Cron fetches both sources in parallel, writes a combined blob to Redis, and soft-fails Flagstand when `DATABASE_URL` is missing so MLB still updates.

## Files Created / Modified

| File | Purpose |
|------|---------|
| `package.json` | Added `@neondatabase/serverless`, `test` script |
| `src/lib/types/scores.ts` | `ScoresBlob`, `MlbScores`, `FlagstandScores` types |
| `src/lib/fetchers/mlb.ts` | ESPN scoreboard fetcher for configured `MLB_TEAM` |
| `src/lib/fetchers/flagstand.ts` | Neon queries scoped to internal SSR org |
| `src/app/api/cron/scores/route.ts` | Authorized cron: parallel fetch → Redis |
| `src/app/api/scores/route.ts` | `GET` scores blob from Redis (503 if missing) |
| `src/lib/fetchers/mlb.test.ts` | Mocked ESPN fetch tests |
| `src/lib/fetchers/flagstand.test.ts` | Mocked Neon sql + org filter tests |

## MLB Score Convention

- **Score format**: `{teamScore}-{opponentScore}` where `team` is the configured `MLB_TEAM` abbreviation (e.g. HOU `4`, opponent `2` → `"4-2"`).
- **Live**: `live: true`, `inning` from ESPN detail (e.g. `"Top 7th"` → `"Top 7"`).
- **Scheduled today**: `nextGame` is today's start ISO; `score` / `inning` null.
- **Final today**: final `score`; `nextGame` is the next scheduled game within 14 days (if any).
- **No game today**: all nulls except `nextGame` when a future game is found.
- API errors throw (cron returns 502).

## Flagstand Queries

1. Resolve internal org: `Organization.isInternal = true`
2. Optional `FLAGSTAND_LEAGUE_IDS` filter via `l.id = ANY(...)`
3. `nextRace`: earliest `SCHEDULED` / `ACTIVE` race night in the future
4. `lastResult`: most recent `COMPLETE` race night

Soft-fail returns `{ lastResult: null, nextRace: null, error?: string }` without breaking MLB.

## API

| Endpoint | Auth | Behavior |
|----------|------|----------|
| `GET /api/cron/scores` | Cron secret / Vercel cron header | Fetch MLB + Flagstand → Redis `scores` key |
| `GET /api/scores` | None | Return cached blob or 503 |

## Tests

```bash
npm test   # 15 tests pass (includes MLB + Flagstand)
npm run build
```

## Env Vars

| Variable | Required | Notes |
|----------|----------|-------|
| `MLB_TEAM` | Yes | Team abbreviation (e.g. `HOU`) |
| `DATABASE_URL` | No | Flagstand; soft-fails if absent |
| `FLAGSTAND_LEAGUE_IDS` | No | Comma-separated league IDs |

## Notes

- Flagstand SQL uses Prisma default quoted table/column names (`"RaceNight"`, `"scheduledAt"`, etc.).
- Cron response may include `flagstandWarning` when Flagstand soft-fails; warning is not stored in Redis.
