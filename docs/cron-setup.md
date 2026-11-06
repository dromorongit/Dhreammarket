# Cron setup

The scheduled jobs are exposed as POST routes protected by `CRON_SECRET`:

- `POST /api/cron/low-stock-alerts` — every 6 hours
- `POST /api/cron/daily-sales-summary` — hourly (the route gates on 19:00 Accra time)
- `POST /api/cron/release-expired-reservations` — every 5 minutes

Each request must include the header `Authorization: Bearer $CRON_SECRET`.

No schema changes are required. Do not touch checkout or existing webhook routes.

## Railway cron

Add one cron job per route in the Railway dashboard, pointing at your deployed app:

| Cron expression | Route | Description |
|-----------------|-------|-------------|
| `0 */6 * * *` | `POST https://<app>.up.railway.app/api/cron/low-stock-alerts` | Low stock alerts |
| `0 * * * *` | `POST https://<app>.up.railway.app/api/cron/daily-sales-summary` | Daily sales summary |
| `*/5 * * * *` | `POST https://<app>.up.railway.app/api/cron/release-expired-reservations` | Release expired reservations |

Set `CRON_SECRET` in the Railway environment variables and pass it in the `Authorization` header (Railway cron supports custom headers).

## External cron (curl example)

```bash
CRON_SECRET="your-secret-here"
API_BASE="https://<app>.up.railway.app"

# Low stock alerts — every 6 hours
curl -X POST "$API_BASE/api/cron/low-stock-alerts" \
  -H "Authorization: Bearer $CRON_SECRET"

# Daily sales summary — hourly (route gates on 19:00 Accra)
curl -X POST "$API_BASE/api/cron/daily-sales-summary" \
  -H "Authorization: Bearer $CRON_SECRET"

# Release expired reservations — every 5 minutes
curl -X POST "$API_BASE/api/cron/release-expired-reservations" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Notes

- `low-stock-alerts` runs fully on each invocation.
- `daily-sales-summary` runs hourly but only sends at 19:00 Accra time (route-side gate).
- `release-expired-reservations` releases reservations older than 30 minutes.
