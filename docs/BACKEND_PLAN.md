# Desk Display Backend Plan

## Stack

- **Runtime**: Next.js App Router (TypeScript) on Vercel
- **Cache**: Upstash Redis (keys: `weather`, `timezones`, `scores`, `airports`)
- **Cron**: Vercel Cron (`vercel.json`) invoking `/api/cron/*` routes
- **Auth**: `Authorization: Bearer <CRON_SECRET>` on all cron endpoints (required; `x-vercel-cron` alone is not accepted)
- **Flagstand**: Read-only Neon connection to SSR Hub (`DATABASE_URL`)

## Public API Contract

All read endpoints return cached JSON from Redis. Cron jobs refresh cache on schedule. Empty cache returns HTTP 503.

### `GET /api/health`

Liveness check.

**Response** `200`:

```json
{ "ok": true }
```

### `GET /api/weather`

Current and forecast weather for the configured home location (`HOME_LAT`, `HOME_LON`). Data from Open-Meteo; alerts from NWS.

**Response** `200` — Redis key `weather`:

```json
{
  "current": {
    "temp": 72,
    "feelsLike": 70,
    "code": 1
  },
  "todayHigh": 85,
  "todayLow": 62,
  "hourly": [
    { "time": "2026-07-23T15:00", "temp": 78, "code": 2 }
  ],
  "alert": {
    "severity": "Moderate",
    "headline": "Heat Advisory"
  },
  "updatedAt": "2026-07-23T12:00:00.000Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `current.temp` | number | °F |
| `current.feelsLike` | number | °F |
| `current.code` | number | WMO weather code |
| `todayHigh` | number | °F |
| `todayLow` | number | °F |
| `hourly` | array | Up to 48 future hours |
| `hourly[].time` | string | ISO local time from Open-Meteo |
| `hourly[].temp` | number | °F |
| `hourly[].code` | number | WMO weather code |
| `alert` | object \| null | Highest-severity active NWS alert |
| `alert.severity` | string | e.g. `Moderate`, `Severe` |
| `alert.headline` | string | NWS headline |
| `updatedAt` | string | ISO timestamp when cache was written |

**Error** `503`: `{ "error": "weather not ready" }`

### `GET /api/timezones`

Sunrise and sunset for fixed timezone cities (see `TIMEZONE_CITIES` in `src/lib/config.ts`).

**Response** `200` — flat map (firmware contract). Redis stores `{ updatedAt, cities }` internally; this route returns `cities` only:

```json
{
  "America/New_York": {
    "sunrise": "2026-07-23T09:45:12+00:00",
    "sunset": "2026-07-24T00:32:18+00:00"
  },
  "America/Chicago": {
    "sunrise": "2026-07-23T10:30:00+00:00",
    "sunset": "2026-07-24T01:15:00+00:00"
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `[iana].sunrise` | string | UTC ISO from sunrise-sunset.org (`formatted=0`) |
| `[iana].sunset` | string | UTC ISO from sunrise-sunset.org |

**Error** `503`: `{ "error": "Timezones data not available" }`

### `GET /api/scores`

Sports scores for configured teams/leagues (`MLB_TEAM`, optional `FLAGSTAND_LEAGUE_IDS`).

**Response** `200` — Redis key `scores`:

```json
{
  "mlb": {
    "live": false,
    "score": null,
    "inning": null,
    "nextGame": "2026-07-24T23:40:00Z",
    "matchup": "Astros @ Mariners",
    "whenEt": "Fri 7/24 7:40 PM",
    "record": "50-54",
    "standingLine": "3rd AL West · 2 GB",
    "teamAbbr": "HOU",
    "opponentAbbr": "SEA",
    "homeAway": "away"
  },
  "flagstand": {
    "lastResult": {
      "id": "uuid",
      "name": "Race Night 12",
      "scheduledAt": "2026-07-20T00:00:00.000Z",
      "trackName": "Main Track",
      "leagueName": "League A",
      "seasonName": "2026 Season"
    },
    "nextRace": {
      "id": "uuid",
      "name": "Race Night 13",
      "scheduledAt": "2026-07-27T00:00:00.000Z",
      "trackName": "Main Track",
      "leagueName": "League A",
      "seasonName": "2026 Season",
      "status": "SCHEDULED"
    }
  },
  "updatedAt": "2026-07-23T12:00:00.000Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `mlb.live` | boolean | Configured team's game in progress |
| `mlb.score` | string \| null | `{teamScore}-{opponentScore}` for `MLB_TEAM` |
| `mlb.inning` | string \| null | e.g. `"Top 7"` while live |
| `mlb.nextGame` | string \| null | ISO start of next game when not live |
| `mlb.matchup` | string \| null | Nickname matchup; home `"Astros vs. Rangers"`, away `"Astros @ Rangers"`; null when live or no next game |
| `mlb.whenEt` | string \| null | Next tip-off in `America/New_York`, e.g. `"Fri 7/24 7:40 PM"`; null when no `nextGame` |
| `mlb.record` | string \| null | Overall W-L for `MLB_TEAM`, e.g. `"50-54"`; null if standings unavailable |
| `mlb.standingLine` | string \| null | Division place + GB/GU, e.g. `"3rd AL West · 2 GB"` or `"1st AL West · 1.5 GU"` |
| `mlb.teamAbbr` | string \| null | Configured `MLB_TEAM` abbreviation, e.g. `"HOU"` |
| `mlb.opponentAbbr` | string \| null | Opponent abbreviation for the described non-live game; null when live or no game |
| `mlb.homeAway` | `"home"` \| `"away"` \| null | Configured team's home/away for that game; null when live or no game |
| `flagstand.lastResult` | object \| null | Most recent completed race |
| `flagstand.nextRace` | object \| null | Next scheduled/active race |
| `flagstand.*.id` | string | Race night UUID |
| `flagstand.*.name` | string | Race night name |
| `flagstand.*.scheduledAt` | string | ISO timestamp |
| `flagstand.*.trackName` | string \| null | Track name |
| `flagstand.*.leagueName` | string | League name |
| `flagstand.*.seasonName` | string | Season name |
| `flagstand.nextRace.status` | string | e.g. `SCHEDULED`, `ACTIVE` |
| `updatedAt` | string | ISO timestamp when cache was written |

Flagstand fields are `null` when `DATABASE_URL` is unset or queries fail (scores cron still succeeds for MLB).

**Error** `503`: `{ "error": "scores not ready" }`

### `GET /api/airport?code=<ICAO>`

Airport coordinates for a given ICAO code (4-letter, e.g. `KDAY`). Stored in Redis hash `airports`.

**Response** `200`:

```json
{
  "lat": 39.902375,
  "lon": -84.219375
}
```

| Field | Type | Notes |
|-------|------|-------|
| `lat` | number | Decimal degrees |
| `lon` | number | Decimal degrees |

**Errors**:

- `400`: `{ "error": "missing code" }`
- `404`: `{ "error": "not found" }`

## Cron Routes

All require `Authorization: Bearer <CRON_SECRET>`.

| Path | Schedule | Purpose | Success response |
|------|----------|---------|------------------|
| `/api/cron/weather` | `*/20 * * * *` | Refresh weather cache | `{ "ok": true }` |
| `/api/cron/timezones` | `0 6 * * *` | Refresh timezone/sunrise data | `{ "ok": true, "cities": <count> }` |
| `/api/cron/scores` | `*/15 * * * *` | Refresh scores cache | `{ "ok": true }` (optional `flagstandWarning`) |
| `/api/cron/seed-airports` | manual | Seed airport hash from OurAirports CSV | `{ "ok": true, "count": <number> }` |

Cron failures return `401` (unauthorized), `502` (upstream error), or `502` with `{ "error": "..." }`.

On Vercel, set `CRON_SECRET` in project env; scheduled invocations receive the Bearer token automatically.

## Environment Variables

See `.env.example`. Required: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `HOME_LAT`, `HOME_LON`, `MLB_TEAM`.

Optional: `HOME_ZIP`, `FLAGSTAND_LEAGUE_IDS`, `DATABASE_URL`, `NWS_USER_AGENT`.

## Non-Goals

- Railway, Trigger.dev, or app-owned Postgres
- ADS-B / live flight tracking
- Personal lat/lon or team defaults in source code (env-only)
