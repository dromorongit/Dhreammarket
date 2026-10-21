# Pre-Deploy Human Checklist — Dhream Market

Branch: `chore/corrective-ledger-foundation` (commit 53266c0) · All items are read-only actions for a human to perform · Do NOT execute any database writes · Do NOT push until C1 is confirmed.

## C1 — Railway deploy target (MUST confirm before push)

- [ ] Open the Railway dashboard for the Dhream Market project.
- [ ] Confirm which branch auto-deploys to production (the repo has no railway.json, Procfile, nixpacks.toml, Dockerfile, or .github/workflows, so this cannot be determined from the repo).
- [ ] Confirm whether PR previews and branch deploys are enabled or disabled.
- [ ] **Do NOT push until the deploy branch is known.** If the deploy branch is not `chore/corrective-ledger-foundation`, pushing this branch will not trigger a production deploy (which may be the intended safe state).

## C5/H-03 — Restart policy and healthcheck

- [ ] Confirm Railway restart policy for the web service (what happens when `npm start` exits because `prisma migrate deploy` failed).
- [ ] Confirm whether a healthcheck path is configured. `app/api/health/route.ts` exists in the repo; verify its implementation does not require the database to return 200 if it is intended as liveness-only.
- [ ] Confirm what Railway does when a new deployment never becomes healthy (does it keep the previous deployment, or route traffic to a failing one?).
- [ ] If unsure, mark as "verify in Railway docs" and do not deploy until confirmed.

## C2/C3/C4/C7 — Run verify-migrations.sql and read-only production checks

Run `docs/pre-deploy-audit/verify-migrations.sql` in the Railway Postgres query tab or psql (READ-ONLY, SELECT only).

Additionally run these read-only queries:

```sql
-- Does the vendor_balance_adjustments table exist at all?
SELECT to_regclass('public.vendor_balance_adjustments');

-- Row count of the clawback ledger table (expect 0; if > 0, NOT NULL re-add on rollback would fail)
SELECT count(*) FROM vendor_balance_adjustments;

-- AdjustmentType enum values (expect CHARGEBACK, FEE_CORRECTION, MANUAL, plus REFUND_CLAWBACK only after deploy)
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AdjustmentType' ORDER BY e.enumsortorder;
```

### Expected results and STOP conditions

| Query | Expected (pre-deploy) | STOP if |
|---|---|---|
| `verify-migrations.sql` — status for `20261020100000_..._enum` | `PENDING_NOT_APPLIED` | `CHECKSUM_MISMATCH` or `APPLIED_BUT_MISSING_LOCALLY` |
| `verify-migrations.sql` — status for `20261020110000_..._columns` | `PENDING_NOT_APPLIED` | `CHECKSUM_MISMATCH` or `APPLIED_BUT_MISSING_LOCALLY` |
| `verify-migrations.sql` — status for all applied migrations | `MATCH` | any `CHECKSUM_MISMATCH` → abort deploy, align checksums first |
| `to_regclass('public.vendor_balance_adjustments')` | `vendor_balance_adjustments` (exists) or `NULL` (not yet created) | If it exists with a schema that conflicts with the migration (e.g. columns already present with NOT NULL), abort |
| `count(*) FROM vendor_balance_adjustments` | `0` | Any value > 0 means NOT NULL re-add on rollback would fail; backfill or delete NULL rows first |
| AdjustmentType enum | `CHARGEBACK, FEE_CORRECTION, MANUAL` | `REFUND_CLAWBACK` already present means the enum migration may already be partially applied |

## Backups (take before push)

- [ ] Take a Railway Postgres dashboard backup.
- [ ] Take a `pg_dump` from a machine that has the PostgreSQL client tools.
- [ ] Note: `scripts/backup-production.ts` does **not** export `Refund`, `ReturnRequest`, or `VendorBalanceAdjustment`. The JSON export in `backups/` is a row-level fallback (no DDL, not restorable with `pg_restore`).

## Deploy

- [ ] Choose a quiet hour.
- [ ] Leave `LEDGER_SHADOW_WRITE` unset (or explicitly `false`) in Railway environment variables. Do NOT set it to `true`.
- [ ] Trigger the deploy. Watch the deploy log for `prisma migrate deploy` lines.
- [ ] Success log lines:
  - `Applying migration 20261020100000_corrective_ledger_refund_clawback_enum`
  - `Applying migration 20261020110000_corrective_ledger_refund_clawback_columns`
  - `Done` / `npm start` proceeds to `node server-entry.js`
- [ ] Stop log lines (abort immediately):
  - `Error: checkpoint ... already exists` or any `checksum mismatch`
  - `already exists` on `CREATE TABLE` or `CREATE TYPE`
  - `npm start` exits without `node server-entry.js` starting

## Post-deploy read-only checks (write nothing, execute nothing against production data)

- [ ] Both `20261020100000_...` and `20261020110000_...` show `finished_at` set and `rolled_back_at` NULL in `_prisma_migrations`.
- [ ] `AdjustmentType` enum contains `CHARGEBACK, FEE_CORRECTION, MANUAL, REFUND_CLAWBACK`.
- [ ] `vendor_balance_adjustments` FK `vendor_balance_adjustments_appliedPayoutId_fkey` is still `ON DELETE RESTRICT`.
- [ ] The app serves `/api/health` (verify it returns 200 without requiring the database if intended as liveness-only).
- [ ] One real refund still settles correctly with `LEDGER_SHADOW_WRITE` off (observe a normal customer refund flow end-to-end; the hook is a no-op when the flag is off).

## Rollback

- [ ] Fastest way to disable the feature: unset `LEDGER_SHADOW_WRITE` or set it to `false` in Railway env, then restart/redeploy as the platform requires (no rebuild needed — it is a runtime env flag, not build-time).
- [ ] Old application code (commit e8db692 or earlier) can run against the relaxed schema: the new columns are nullable/defaulted and the new enum value is additive, so previous code paths never reference them. Confirm by reading `lib/refunds/refund-service.ts` and `lib/webhooks/refund-webhook-handler.ts` at the previous commit vs current — the only difference is the flag-gated hook calls.
- [ ] `ALTER TYPE ... ADD VALUE 'REFUND_CLAWBACK'` cannot be removed from PostgreSQL. Safe recovery: leave the value in place and simply stop using it (docs/corrective-ledger/DESIGN.md section 7.2). Re-creating the type without it is a full table rewrite and is not recommended.

## Migration drift stop condition

If `verify-migrations.sql` returns any `CHECKSUM_MISMATCH` for an already-applied migration, `prisma migrate deploy` will abort on that migration and no pending migration will run. Do not deploy until the production `_prisma_migrations.checksum` values are reconciled with the committed blobs.
