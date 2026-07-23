# Task B Report — Weather + Alerts

**Status**: DONE  
**Date**: 2026-07-23

## Summary

Implemented Open-Meteo weather fetching, NWS active alerts, cron cache refresh, and public read API. Added vitest config and fetcher unit tests with mocked `fetch`. All 7 tests pass; `npm run build` succeeds.

## Files Created / Modified

| File | Purpose |
|------|---------|
| `src/lib/types/weather.ts` | `WeatherBlob` type (current, today high/low, hourly, alert, updatedAt) |
| `src/lib/fetchers/weather.ts` | `fetchWeather(lat, lon)` — Open-Meteo with Fahrenheit units |
| `src/lib/fetchers/nws.ts` | `fetchNwsAlerts(lat, lon)`, `pickHighestSeverityAlert()` |
| `src/app/api/cron/weather/route.ts` | Auth, parallel fetch, Redis `set`, 502 on upstream failure (no wipe) |
| `src/app/api/weather/route.ts` | `GET` — read Redis; 503 if missing |
| `vitest.config.ts` | Path alias `@` → `./src` |
| `package.json` | Added `"test": "vitest run"` |
| `src/lib/fetchers/weather.test.ts` | Open-Meteo parse test (mocked fetch) |
| `src/lib/fetchers/nws.test.ts` | Severity pick + empty alerts tests |

## API Contract (`WeatherBlob`)

```json
{
  "current": { "temp": 72.5, "feelsLike": 70, "code": 1 },
  "todayHigh": 85.2,
  "todayLow": 62.1,
  "hourly": [{ "time": "2026-07-23T13:00", "temp": 74, "code": 2 }],
  "alert": { "severity": "Severe", "headline": "..." } | null,
  "updatedAt": "2026-07-23T12:00:00.000Z"
}
```

## Upstream Sources

- **Open-Meteo**: `https://api.open-meteo.com/v1/forecast` — current, daily (today), hourly (next 48h, future-only)
- **NWS**: `https://api.weather.gov/alerts/active?point={lat},{lon}` — `User-Agent` from `NWS_USER_AGENT` or `desk-display-backend`; severity ranked Extreme > Severe > Moderate > Minor > Unknown

## Error Behavior

| Route | Condition | Response |
|-------|-----------|----------|
| `GET /api/cron/weather` | Unauthorized | 401 |
| `GET /api/cron/weather` | Upstream failure | 502 `{ error }` — Redis unchanged |
| `GET /api/cron/weather` | Success | 200 `{ ok: true }` |
| `GET /api/weather` | No cache | 503 `{ error: "weather not ready" }` |
| `GET /api/weather` | Cached | 200 `WeatherBlob` |

## Verification

```bash
npm test        # 7 passed
npm run build   # ✓ includes /api/weather, /api/cron/weather
```

### Manual checks (with env configured)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weather
# → {"ok":true}

curl http://localhost:3000/api/weather
# → WeatherBlob JSON (or 503 if cron not run yet)
```

## Notes for Downstream Agents

1. **Hourly times** are Open-Meteo local-time strings (no offset); clients should treat as location-local.
2. **NWS null alert** means no active alerts, not an error.
3. **Cron parallel fetch** — weather and NWS run together; either failure yields 502 without touching Redis.
4. Did not modify timezone/scores/airport routes, `TIMEZONE_CITIES`, or README.

## Git

No commit (per instruction).
