# Corrective Ledger - deployment runbook

The two migrations in this directory will be applied to production by
`prisma migrate deploy`, which the Railway `start` script already runs
(`package.json`: `"start": "prisma migrate deploy && cross-env ... node server-entry.js"`).

This runbook records what was verified before that happens, how to roll back,
and what could **not** be done from a developer machine.

## 1. The rollback point

| | |
| --- | --- |
| Branch | `chore/corrective-ledger-foundation` |
| Commit | `933ea6b` - *chore(ledger): add the dormant corrective ledger, the safety net and the corrections* |
| Base | `e0c6553` (on `chore/local-dev-database`), which is 1 commit ahead of `origin/main` and 17 ahead of `production` |

Everything that was uncommitted when this started - the safety net
(`docs/safety-net/`, the two `*.characterization.test.ts` files), the ledger
foundation (`lib/ledger/`, `docs/corrective-ledger/`, the schema change and the
two migrations) and the corrective pass (the `onDelete: Restrict` fix and the
switch to the refundable cap) - is in that one commit.

**To roll the code back:** deploy `e0c6553` instead. Nothing in the ledger is
active, so no data has to be rolled back with it.

**To roll the schema back:** nothing is needed. Both migrations are relaxing or
additive, and the ledger is dormant, so no row can carry the new enum value or
the new columns. `docs/corrective-ledger/DESIGN.md` section 7.2 has the
manual rollback SQL for completeness.

## 2. Production state as observed on 2026-10-20

Read-only probes against the production database (`DATABASE_URL` from `.env`,
which `docs/local-database.md` documents as the production Railway URL). No
credential was printed and no write was performed.

| Fact | Value |
| --- | --- |
| Engine | PostgreSQL 18.6 |
| Public tables | 136 |
| Applied migrations | 32 (latest `20261019000000_seller_os_money_view`, finished 2026-10-20 02:56:54 UTC) |
| `20261020100000_...` / `20261020110000_...` | **not applied** |
| `vendor_balance_adjustments` rows | **0** |
| `AdjustmentType` labels | `CHARGEBACK`, `FEE_CORRECTION`, `MANUAL` - no `REFUND_CLAWBACK` yet |
| `vendor_balance_adjustments.appliedPayoutId` | `text NOT NULL` |
| `vendor_balance_adjustments.appliedAt` | `timestamp NOT NULL` |
| `vendor_balance_adjustments_appliedPayoutId_fkey` | **`ON DELETE RESTRICT ON UPDATE CASCADE`** |

The last row is the important one: it confirms, against the live database, the
drift that the corrective pass fixed. Prisma's default for an *optional*
relation is `SetNull`, so the datamodel would have claimed `SetNull` while the
database enforces `Restrict` - and `SetNull` would have silently re-opened an
applied debit. `prisma/schema.prisma` now states `onDelete: Restrict`
explicitly.

## 3. The backup

Taken with the repository's own tooling, before anything was applied:

```bash
npm run db:generate                      # not required, but prisma generate was run
npx tsx scripts/backup-production.ts     # exports every model to backups/*.json
npx tsx scripts/verify-backup.ts         # compares the backup against the live rows
```

| | |
| --- | --- |
| Output | `backups/` (gitignored - `/backups` in `.gitignore`) |
| Models exported | 130, **0 errors** |
| Rows exported | 3304 |
| Size | 130 files, 1.34 MB |
| Verification | 125 of 126 comparison rows match exactly |

The one row that does not match is `Influencer`, and it is an artefact of
`scripts/verify-backup.ts` itself: it hardcodes `backup: 0, match: false` for
that model and exports it through raw SQL instead. The backup does contain the
row (`backups/influencers-raw.json`, 1 row).

### 3.1 What the backup does NOT cover

`scripts/backup-production.ts` exports a fixed list of models. It does **not**
include `VendorBalanceAdjustment`, `Refund` or `ReturnRequest` - three money
tables.

For **these** two migrations that is harmless: the only table they touch is
`vendor_balance_adjustments`, which is empty (0 rows), and the other object
they touch is the `AdjustmentType` enum, which is schema rather than data. But
the gap should be closed before a migration that touches `refunds` or
`return_requests` is deployed. Reported, not fixed - it is outside the files
this task may change.

### 3.2 The two backup copies the runbook asks for are missing

`docs/influencer-perks-release.md` asks for three things before a migration:

1. a Railway Postgres backup (the dashboard / `railway` CLI),
2. a `pg_dump` copy,
3. an optional restore into a separate staging database.

Only (3) was possible in a form, and it was done against a scratch database
(section 4). (1) and (2) **cannot** be produced from this machine:

- the Railway CLI is installed but not logged in (`railway status` returns
  `Unauthorized`), and there is no `.railway` project link;
- there is no `pg_dump` binary on this machine and no PostgreSQL client
  installation at all.

**Action required before the production deploy:** take the Railway Postgres
backup from the Railway dashboard, and a `pg_dump` copy from a machine that has
the PostgreSQL client tools. The JSON export in `backups/` is a row-level
fallback, not a substitute - it has no DDL, and it cannot be restored with
`pg_restore`.

## 4. The pre-production check (what "apply to staging" became)

There is **no staging environment** this repository can reach:

- no staging `DATABASE_URL` anywhere in the repo or the environment;
- no local PostgreSQL - Docker is not installed, `wsl -l -v` lists no
  distribution, and no PostgreSQL client or server binaries exist on the
  machine, so the `db:dev:*` scripts in `docs/local-database.md` cannot run;
- the Railway CLI is not logged in.

So the check was done the next best way, on the production server itself, with
**no production data and no production schema touched**:

1. `CREATE DATABASE dhream_migration_check` on the same server.
2. The production **schema** was cloned into it with
   `prisma migrate diff --from-empty --to-config-datasource --script`
   (146 665 bytes of DDL). The clone was verified to be faithful: the scratch
   database generates **byte-identical DDL** to production.
3. The two migration files were executed **verbatim**, each in **its own
   transaction** - the way `prisma migrate deploy` runs them.
4. The result was inspected and diffed against `prisma/schema.prisma`.
5. The scratch database was dropped (confirmed absent afterwards).

### Result

| Check | Result |
| --- | --- |
| `20261020100000_corrective_ledger_refund_clawback_enum` | applied in a transaction, no error |
| `20261020110000_corrective_ledger_refund_clawback_columns` | applied in a transaction, no error |
| `ALTER TYPE ... ADD VALUE` inside a transaction (PostgreSQL 12+ requirement) | works on 18.6 |
| `vendor_balance_adjustments` after the migration | matches `prisma/schema.prisma` exactly |
| `AdjustmentType` after the migration | `CHARGEBACK, FEE_CORRECTION, MANUAL, REFUND_CLAWBACK` |
| `appliedPayoutId` / `appliedAt` | now nullable |
| `idempotencyKey` | `text NULL`, unique index `vendor_balance_adjustments_idempotencyKey_key` |
| `currency` | `text NOT NULL DEFAULT 'GHS'` |
| `vendor_balance_adjustments_storeId_appliedPayoutId_idx` | created |
| `vendor_balance_adjustments_appliedPayoutId_fkey` | still **`ON DELETE RESTRICT`** - the migrations do not touch it, and the datamodel now matches it |

After the migrations, the diff between the scratch database and
`prisma/schema.prisma` contained **no statement about
`vendor_balance_adjustments` or `AdjustmentType`**. The ledger part of the
schema is exactly in sync.

### 4.1 Pre-existing drift that is NOT from these migrations

The same diff did list differences - but all of them are in tables these
migrations never touch, and they are present in production *today*, before any
of this work:

```
-- DropIndex      influencer_clicks_ipAddress_idx
-- DropIndex      return_requests_one_open_per_item_idx
-- DropIndex      idx_users_influencerAttributionCode
-- AlterTable     influencers, influencer_cashbacks, vendor_post_*, ...
-- CreateIndex    influencer_cashbacks_order_id_idx, subscription_usage_*, ...
-- AddForeignKey  collection_items, vendor_follows, flash_deal_products,
--                vendor_trust_badges, reward_*, cashback_*, customer_*,
--                referral_records, reward_redemptions, vendor_reward_*,
--                vendor_subscriptions, subscription_*, advertisement_*
-- RenameIndex    idx_influencer_cashbacks_*, idx_vendor_subscriptions_*
```

The proof that this is pre-existing: running
`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
against **production** produces exactly the same list, alongside the two
migrations' own statements. `prisma migrate deploy` applies migration *files*,
not the datamodel, so it will not reconcile this drift - and it does not need
to. Nothing about it blocks this deploy.

## 5. Applying it to production

The start script already does it. To do it deliberately first:

```bash
npx prisma migrate status   # expect: 34 migrations found, 32 applied
npx prisma migrate deploy   # applies the two new migrations
npx prisma migrate status   # expect: up to date
```

Expected output:

```
Applying migration `20261020100000_corrective_ledger_refund_clawback_enum`
Applying migration `20261020110000_corrective_ledger_refund_clawback_columns`
```

Then deploy the code.

### 5.1 Operational notes

- `ALTER TYPE "AdjustmentType" ADD VALUE` takes an `ACCESS EXCLUSIVE` lock on
  the type. `vendor_balance_adjustments` is empty and the type is only read by
  that table, so the lock is brief - but it is a lock, and it is the one
  statement in the two migrations that is not purely metadata.
- Everything else is metadata-only on PostgreSQL 18: adding a column with a
  constant default does not rewrite the table, `DROP NOT NULL` is a catalog
  change, and both index creations run against an empty table.
- The `start` script runs `prisma migrate deploy` on boot, so **the migrations
  will be applied by the deploy itself** if nobody applies them first. That is
  fine - but it means the backup must exist before the deploy is triggered,
  which is why section 3 is not optional.

## 6. Housekeeping findings

- **A leftover shadow database in production.** `prisma_migrate_shadow_db_3fda68b0-f92a-430d-9190-ef464d2b8af9`
  (9 838 kB) is a leftover from a `prisma migrate dev` run. It is harmless but
  it should be dropped. Not dropped here - dropping a database in production is
  not this task's call.
- **The application role is a superuser** on the production server
  (`rolsuper = true`, `rolcreatedb = true`). That is a far larger blast radius
  than a production application role needs.
- `_prisma_migrations` contains rows with `rolled_back_at` set for six
  migrations that are also recorded as successfully applied. That is the
  normal `migrate dev` retry trail, not a problem, but it does mean
  `SELECT count(*) FROM _prisma_migrations` overstates the number of applied
  migrations.
