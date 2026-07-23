# Task A Report — Scaffold

**Status**: DONE  
**Date**: 2026-07-23

## Summary

Next.js App Router + TypeScript scaffold created with Redis/cron infrastructure, stub API routes, and Vercel cron config. `npm run build` passes without env vars (lazy config loading).

## Files Created / Modified

### Scaffold (create-next-app)

- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`
- `eslint.config.mjs`, `postcss.config.mjs`
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/favicon.ico`
- `public/*` (default Next.js assets)
- `README.md`, `AGENTS.md`, `CLAUDE.md` (from create-next-app template)

### Project-specific

| File | Purpose |
|------|---------|
| `.gitignore` | Ignores `.env`, `.env.local`, `node_modules`, `.next`, etc. (`.env.example` not ignored) |
| `.env.example` | Documented env vars with placeholders only |
| `vercel.json` | Cron schedules for weather, timezones, scores |
| `docs/BACKEND_PLAN.md` | API contract summary, stack notes, non-goals |
| `src/lib/config.ts` | `REDIS_KEYS`, `TIMEZONE_CITIES`, `getRequiredEnv`, `getConfig` |
| `src/lib/redis.ts` | Lazy singleton Upstash Redis client |
| `src/lib/cron-auth.ts` | `isCronAuthorized`, `authorizeCron` |
| `src/app/api/health/route.ts` | `GET` → `{ ok: true }` |
| `src/app/api/cron/weather/route.ts` | Stub cron (auth + `{ ok: true, stub: true }`) |
| `src/app/api/cron/timezones/route.ts` | Stub cron |
| `src/app/api/cron/scores/route.ts` | Stub cron |
| `src/app/page.tsx` | Minimal one-line UI: `desk-display-backend` |

### Dependencies added

- `@upstash/redis` (runtime)
- `vitest` (dev, for later agents)

## How to Run

```bash
cd /Users/bruceclingan/Projects/desk-display-backend
cp .env.example .env.local
# Fill in UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, CRON_SECRET,
# HOME_LAT, HOME_LON, MLB_TEAM (and optional vars)

npm run dev      # http://localhost:3000
npm run build    # production build (verified passing)
npm run start    # serve production build
```

### Quick checks

```bash
curl http://localhost:3000/api/health
# → {"ok":true}

curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weather
# → {"ok":true,"stub":true}
```

## Git

- `git init` run in workspace (branch: `master`)
- **No commit** (per user instruction)

## Build Verification

```
npm run build  # ✓ success (no env vars required at build time)
```

Routes registered:

- `/` (static)
- `/api/health`
- `/api/cron/weather`, `/api/cron/timezones`, `/api/cron/scores` (dynamic)

## Concerns / Notes for Downstream Agents

1. **Leftover temp dir**: `desk-display-backend-tmp` may still exist at `/Users/bruceclingan/Projects/desk-display-backend-tmp` (contains `.git` and `.next` from create-next-app). Safe to delete manually; not part of the workspace.

2. **Cron auth**: `authorizeCron` accepts either `Authorization: Bearer <CRON_SECRET>` or `x-vercel-cron: 1`. The Vercel header alone is spoofable; domain agents may want to tighten this to Bearer-only in production.

3. **Public read APIs not scaffolded**: `/api/weather`, `/api/timezones`, `/api/scores`, `/api/airport` are documented in `docs/BACKEND_PLAN.md` but not implemented (intentional — separate agents).

4. **`DATABASE_URL`** in `.env.example` is documented for future use; no DB client installed yet.

5. **`vitest`** installed but no test script or config added — agents can add `"test": "vitest"` when needed.

6. **Package name** updated from `desk-display-backend-tmp` to `desk-display-backend`.

7. **America/Los_Angeles** entry uses Las Vegas coordinates per spec (36.1699, -115.1398) while IANA id remains `America/Los_Angeles`.

8. **No personal defaults** in source — all location/team config is env-driven; placeholders only in `.env.example`.
