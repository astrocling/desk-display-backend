# Desk Display Backend Plan

## Stack

- **Runtime**: Next.js App Router (TypeScript) on Vercel
- **Cache**: Upstash Redis (keys: `weather`, `timezones`, `scores`, `airports`, `wpbl:league`, `wpbl:leaders`, `wpbl:game:{id}`)
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

**Response** `200` — Redis key `scores`. While an MLB or WPBL game may be live (cached live flags / `nextGame` / WPBL `startIso` ≤ now), the handler may refresh MLB (ESPN) and WPBL if `updatedAt` is older than ~45s, then rewrite Redis. On ESPN failure it returns the last good blob; WPBL soft-fails independently and keeps last-good `wpbl` when present.

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
      "seasonName": "2026 Season",
      "seriesName": "UMP Modifieds"
    },
    "nextRace": {
      "id": "uuid",
      "name": "Race Night 13",
      "scheduledAt": "2026-07-27T00:00:00.000Z",
      "trackName": "Main Track",
      "leagueName": "League A",
      "seasonName": "2026 Season",
      "seriesName": "UMP Modifieds",
      "status": "SCHEDULED"
    }
  },
  "wpbl": {
    "games": [
      {
        "status": "live",
        "inning": "Top 5",
        "awayAbbr": "BOS",
        "homeAbbr": "LA",
        "awayName": "Hunters",
        "homeName": "Queens",
        "awayRuns": 2,
        "homeRuns": 4,
        "whenEt": null,
        "startIso": "2026-08-10T23:00:00.000Z"
      }
    ],
    "standings": [
      { "abbr": "LA", "name": "Queens", "w": 3, "l": 1, "pct": ".750", "gb": "—" }
    ]
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
| `mlb.opponentAbbr` | string \| null | Opponent abbreviation for live or next game; null when no game |
| `mlb.homeAway` | `"home"` \| `"away"` \| null | Configured team's home/away; null when no game |
| `mlb.teamRuns` | number \| null | Configured team runs (live/final) |
| `mlb.opponentRuns` | number \| null | Opponent runs (live/final) |
| `mlb.balls` / `strikes` / `outs` | number \| null | Live count; null when not live |
| `mlb.onFirst` / `onSecond` / `onThird` | boolean \| null | Live base occupancy |
| `mlb.batterName` / `pitcherName` | string \| null | ESPN short names while live |
| `mlb.batterAvg` / `pitcherEra` | string \| null | Season AVG/ERA from ESPN game-summary boxscore while live; null if summary unavailable or player not found |
| `mlb.batterSummary` / `pitcherSummary` | string \| null | Game line from ESPN situation while live (e.g. `"1-3, BB"`, `"5.0 IP, 2 ER, 4 H, 6 K"`) |
| `flagstand.lastResult` | object \| null | Most recent completed race |
| `flagstand.nextRace` | object \| null | Next scheduled/active race |
| `flagstand.*.id` | string | Race night UUID |
| `flagstand.*.name` | string | Race night name |
| `flagstand.*.scheduledAt` | string | ISO timestamp |
| `flagstand.*.trackName` | string \| null | Track name |
| `flagstand.*.leagueName` | string | League name |
| `flagstand.*.seasonName` | string | Season label (`Season.name`) |
| `flagstand.*.seriesName` | string \| null | Series name (`Series.name`); null when season has no series |
| `flagstand.nextRace.status` | string | e.g. `SCHEDULED`, `ACTIVE` |
| `wpbl.games` | array | Today’s WPBL slate (≤4); `status` `scheduled`\|`live`\|`final` |
| `wpbl.games[].startIso` | string \| null | ISO tip for refresh gating |
| `wpbl.games[].whenEt` | string \| null | ET display for scheduled games |
| `wpbl.standings` | array | Ranked 4-team table (≤4) |
| `updatedAt` | string | ISO timestamp when cache was written |

Flagstand fields are `null` when `DATABASE_URL` is unset or queries fail (scores cron still succeeds for MLB). Flagstand may still be populated; dial Sports UI shows MLB ↔ WPBL (Flagstand dormant on device). WPBL is ingested from the official stats homepage (HTML scrape) and soft-fails to empty/last-good arrays. **Dial path unchanged** — this `wpbl` slice is separate from the JSON `/api/wpbl*` routes below.

**Error** `503`: `{ "error": "scores not ready" }`

### `GET /api/wpbl`

Full WPBL league board: standings + schedule. Data from WPBL Stats API v1; cached by cron.

**Response** `200` — Redis key `wpbl:league`:

```json
{
  "updatedAt": "2026-08-10T12:00:00.000Z",
  "seasonId": "abc123",
  "standings": [
    {
      "teamId": "1",
      "abbr": "LA",
      "name": "Queens",
      "rank": 1,
      "w": 3,
      "l": 1,
      "t": 0,
      "pct": ".750",
      "gb": "—",
      "rf": 28,
      "ra": 18,
      "diff": 10,
      "l10": "5-3",
      "streak": "W2"
    }
  ],
  "games": [
    {
      "id": "game-uuid",
      "status": "live",
      "startIso": "2026-08-10T23:00:00.000Z",
      "whenEt": null,
      "awayAbbr": "BOS",
      "homeAbbr": "LA",
      "awayName": "Hunters",
      "homeName": "Queens",
      "awayRuns": 2,
      "homeRuns": 4,
      "venue": "Field A",
      "countsInStandings": true
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `seasonId` | string | Active WPBL season |
| `standings` | array | Full 4-team table; neutral (no team filter) |
| `games` | array | Full season schedule; `status` `scheduled`\|`live`\|`final`\|`other` |
| `games[].countsInStandings` | boolean | Excluded games (e.g. exhibitions) flagged |
| `updatedAt` | string | ISO timestamp when cache was written |

**Error** `503`: `{ "error": "WPBL league cache empty" }`

### `GET /api/wpbl/leaders`

Season batting and pitching leaderboards. Cron refresh; partial upstream failures set `partial: true` and keep last-good boards.

**Response** `200` — Redis key `wpbl:leaders`:

```json
{
  "updatedAt": "2026-08-10T12:00:00.000Z",
  "seasonId": "abc123",
  "partial": false,
  "qualifiers": { "battingMinAb": 10 },
  "batting": {
    "avg": [{ "playerId": "p1", "name": "Jane Doe", "teamAbbr": "LA", "value": ".312", "sortValue": 0.312 }],
    "hr": [],
    "rbi": [],
    "h": []
  },
  "pitching": {
    "era": [],
    "so": [],
    "w": [],
    "sv": []
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `partial` | boolean | `true` if some player stat fetches failed |
| `qualifiers.battingMinAb` | number | Minimum AB for AVG board (default **10**) |
| `batting.avg` / `hr` / `rbi` / `h` | array | Top entries per category |
| `pitching.era` / `so` / `w` / `sv` | array | Top entries per category |
| `*.value` | string | Display-ready stat string |
| `updatedAt` | string | ISO timestamp when cache was written |

**Error** `503`: `{ "error": "WPBL leaders cache empty" }`

### `GET /api/wpbl/games/[id]`

Game detail with line score and box score. Per-game Redis key `wpbl:game:{id}`. Live games refresh on read when `updatedAt` is older than ~45s; on upstream failure returns last-good blob when present.

**Response** `200`:

```json
{
  "updatedAt": "2026-08-10T23:30:00.000Z",
  "game": {
    "id": "game-uuid",
    "status": "live",
    "inning": "Top 5",
    "startIso": "2026-08-10T23:00:00.000Z",
    "whenEt": null,
    "awayAbbr": "BOS",
    "homeAbbr": "LA",
    "awayName": "Hunters",
    "homeName": "Queens",
    "awayRuns": 2,
    "homeRuns": 4,
    "venue": "Field A",
    "countsInStandings": true
  },
  "boxscore": {
    "available": true,
    "lineScore": {
      "maxInning": 9,
      "teams": [
        {
          "side": "away",
          "abbr": "BOS",
          "name": "Hunters",
          "innings": [{ "inning": 1, "runs": 0 }],
          "runs": 2,
          "hits": 5,
          "errors": 0,
          "lob": 3
        }
      ]
    },
    "batting": [{ "side": "away", "name": "Player", "position": "SS", "stats": { "ab": 4, "h": 2 } }],
    "pitching": [{ "side": "home", "name": "Pitcher", "position": "P", "stats": { "ip": "5.0", "er": 2 } }]
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `game.inning` | string \| null | e.g. `"Top 5"` while live |
| `boxscore.available` | boolean | `false` when box not yet published |
| `boxscore.lineScore` | object \| null | Inning-by-inning R/H/E/LOB |
| `boxscore.batting` | array | Hitting lines (upstream `hitting` mapped here) |
| `boxscore.pitching` | array | Pitching lines |
| `updatedAt` | string | ISO timestamp when cache was written |

**Errors**:

- `404`: `{ "error": "Game not found" }` (no cache and upstream failed)
- `503`: not used on this route (stale cache served on failure)

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
| `/api/cron/wpbl` | `*/5 * * * *` | Refresh `wpbl:league` + `wpbl:leaders` | `{ "ok": true, "games": <count>, "leadersPartial": <bool> }` |
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
