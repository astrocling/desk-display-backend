# Manual deploy checklist (you)

Agents implement code only. Complete these before production works.

## 1. GitHub
- Create empty repo `desk-display-backend`
- From this directory: add remote, push `master`/`main`

## 2. Vercel
- Import the GitHub repo (Next.js)
- Confirm Production branch

## 3. Upstash Redis (Vercel Marketplace)
- Add Upstash Redis integration to the project
- Confirm Redis env appears (Marketplace usually sets `KV_REST_API_URL` + `KV_REST_API_TOKEN`; either those or `UPSTASH_REDIS_*` work)

## 4. Neon read-only role (SSR Hub project)
In Neon SQL Editor on the **ssr-web** database:

```sql
CREATE ROLE desk_display_readonly LOGIN PASSWORD '<long-password>';
GRANT CONNECT ON DATABASE neondb TO desk_display_readonly;
GRANT USAGE ON SCHEMA public TO desk_display_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO desk_display_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO desk_display_readonly;
```

Connect modal → select `desk_display_readonly` + **pooled** → copy URL → Vercel `DATABASE_URL`.

## 5. Vercel env vars
| Var | Example / notes |
|-----|-----------------|
| `CRON_SECRET` | long random string — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when this is set |
| `HOME_LAT` | from ZIP 45373 geocode |
| `HOME_LON` | from ZIP 45373 geocode |
| `MLB_TEAM` | `HOU` |
| `HOME_ZIP` | optional `45373` |
| `FLAGSTAND_LEAGUE_IDS` | optional comma-separated UUIDs |
| `NWS_USER_AGENT` | `desk-display-backend (you@email)` |
| `DATABASE_URL` | readonly pooled Neon URL (optional; Flagstand disabled without it) |
| Upstash vars | from Marketplace |

## 6. Deploy + seed
- Deploy Production
- Confirm Cron Jobs in Vercel dashboard: weather `*/20`, timezones `0 6 * * *`, scores `*/15`
- Seed airports (one-time or after Redis reset):
  - **Local/script**: `npm run seed:airports` with prod Redis env in `.env.local`
  - **HTTP**: `GET /api/cron/seed-airports` with `Authorization: Bearer $CRON_SECRET`

## 7. Verify
```bash
export CRON_SECRET='<your-secret>'
HOST=https://<your-vercel-host>

curl "$HOST/api/health"
curl "$HOST/api/weather"
curl "$HOST/api/timezones"
curl "$HOST/api/scores"
curl "$HOST/api/airport?code=KDAY"

curl -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/weather"
curl -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/timezones"
curl -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/scores"
curl -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/seed-airports"
```

Expect `503` on read APIs until the corresponding cron has run at least once.

## 8. Firmware
Update `desk-display-firmware` API contract from [BACKEND_PLAN.md](./BACKEND_PLAN.md) when field names change.
