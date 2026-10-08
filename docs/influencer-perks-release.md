# Influencer Perks Release Runbook

## Pre-flight Safety

- [ ] **BACKUP FIRST**: Take a full production database backup via Railway Postgres backup AND a `pg_dump` copy. Confirm the backup can be restored before doing anything else. Do not proceed until this is done.
- [ ] (Optional but recommended) Restore the backup into a separate staging database and run the migration there first.

## Environment Preparation

- [ ] Set `CRON_SECRET` in Railway before deploying. Choose a strong, random value.
- [ ] Confirm the local/dev `DATABASE_URL` points to a throwaway database, not production. Never run migrations or queries against production data from your local machine.

## Deploy Order

The migration is fully additive and backward-compatible. Old code will continue to work against the new schema, and the new code will work for all existing users, vendors, orders, and subscriptions that have no influencer data.

1. **Apply the migration to production** (additive only):
   ```bash
   npx prisma migrate deploy
   ```
   This runs `20261008000000_add_influencer_perks`. It adds nullable columns, safe defaults, a new table, and the `INFLUENCER` enum value. It does not drop, rename, retype, truncate, or delete anything.

2. **Deploy the code**:
   - The Railway `start` script already runs `prisma migrate deploy` on boot, but run it manually first so the schema is ready before new code starts serving traffic.
   - Deploy the updated code after the migration succeeds.

## Cron Setup

- [ ] Schedule the Railway cron or external cron to hit:
   ```
   POST /api/cron/influencer-trial-expiry
   Authorization: Bearer $CRON_SECRET
   ```
   Recommended: daily at `02:00 UTC`.

- [ ] **Run a dry-run first** to verify behavior without changing data:
   ```bash
   curl -X POST "https://yourdomain.com/api/cron/influencer-trial-expiry?dryRun=true" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   Confirm the response lists the subscriptions that *would* be downgraded.

## Post-deploy Smoke Tests

- [ ] **Normal signup**: Register a new customer with no influencer code. Confirm no points are granted, no trial is created, and the response does not include `influencerPerk`.
- [ ] **Link signup (customer)**: Register via a valid influencer link. Confirm the user receives 500 points once.
- [ ] **Link signup (vendor)**: Register a vendor via a valid influencer link. Confirm a Starter subscription is created with `planExpiresAt` one month out and `source: INFLUENCER`.
- [ ] **Order flow**: Place an order as an attributed customer. Confirm cashback is credited for orders 1-5 and withheld on order 6.
- [ ] **Vendor dashboard**: Confirm the vendor can still view orders, update statuses, and the dashboard loads.
- [ ] **Homepage featured vendors**: Confirm featured vendor sections still render.

## Rollback Plan

Because the migration is additive:

- **Code-level rollback**: Redeploy the previous code. The old code ignores the new nullable columns and enum value, so it continues to work.
- **Data rollback**: Do NOT roll back by dropping columns or restoring over live data unless the backup restore is truly needed.
- **If a migration issue is discovered**: Stop the deploy, restore from the backup taken in pre-flight, and investigate.

## Monitoring (First 24 Hours)

Watch for the following in logs and database:

- **Failed perk grants**: Errors in `creditInfluencerSignupBonus` or `creditInfluencerOrderCashback` should be logged but must not break registration or order completion.
- **Cron results**: Every run of `/api/cron/influencer-trial-expiry` should log the number of downgraded and notified vendors. Alert if it returns 500.
- **Cashback records**: Spot-check `influencer_cashbacks` and `cashback_transactions` for unexpected duplicates or amounts.
- **Negative balances**: Query `cashback_balances` and `reward_points` for any balance `< 0`. This should never happen.
- **Subscription downgrades**: Verify that only subscriptions with `source: 'INFLUENCER'` and `plan: Starter` and past `planExpiresAt` are downgraded. Paid vendors must not be touched.

## What Was Changed

- **Migration**: `prisma/migrations/20261008000000_add_influencer_perks/migration.sql` - additive only.
- **Cron route**: `app/api/cron/influencer-trial-expiry/route.ts` - fail-closed auth, constant-time token comparison, dry-run mode.
- **Trial expiry logic**: `lib/influencer/vendor-trial.ts` - per-vendor try/catch, dry-run support, idempotent downgrades.
- **Auth routes**: `app/api/auth/register/route.ts` and `app/api/auth/verify-email/route.ts` - only store `influencerAttributionCode` when the code exists and is active.
- **Tests**: New unit tests for signup bonus, order cashback, trial expiry, and cron auth.
- **Lint/typecheck**: Pass.
