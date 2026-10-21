# PRE-DEPLOYMENT SAFETY AUDIT — Dhream Market
Branch: `chore/corrective-ledger-foundation` (HEAD e8db692) · Read-only audit · No file modified, no database or network access.

## VERDICT: GO WITH CONDITIONS

Nothing in the push set is destructive: every pending migration is additive or relaxing, the feature flag defaults to OFF, no new required environment variable exists, no runtime data path is changed by the committed code, and typecheck/lint/tests are clean.
However, deploy safety cannot be PROVED from read-only evidence alone: the production applied-migration state contradicts the only allowed evidence (25 applied per backups/prisma-migrations-raw.json vs 32 claimed in docs/corrective-ledger/DEPLOYMENT.md), 10 applied migrations show checksum drift vs the working tree, no deploy configuration or restart policy exists in the repo, and the production build could not complete within the verification time cap.
Deploy only after preconditions C1-C6 (section "UNVERIFIED items") are satisfied. If production checksums differ from the repo or `migrate deploy` aborts on drift, treat as NO-GO.

## Findings summary

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| HIGH | 4 |
| MEDIUM | 4 |
| LOW | 3 |
| INFO | 8 |
| Total | 19 |

## Findings table (ID · severity · area · description · evidence · recommended action · who)

| ID | Sev | Area | Description | Evidence | Recommended action | Who |
|---|---|---|---|---|---|---|
| H-01 | HIGH | C | Checksum drift: 10 of 25 applied migrations in backups/prisma-migrations-raw.json have checksums that differ from the working-tree migration.sql files (4 truncated/placeholder: "abc123" and 43-char values; 7 full-length mismatches: 20260722120000_verify_existing_users, 20260916125938_add_marketing_officer_referral, 20260916133000_add_pending_registration_marketing_code, 20260916134000_fix_vendor_referral_fk_restrict, 20260923233838_add_influencer_program, 20260926010000_add_vendor_feed, 20260930120000_add_app_waitlist; plus 20260731000000_add_service_average_rating_review_count recorded as "abc123")). If production `_prisma_migrations` records these checksums, `prisma migrate deploy` aborts on drift -> deploy fails, app may not start. None of the mismatched files are changed by this branch (pre-existing). Unverified against production. | sha256 of working-tree files vs recorded checksums (command output in section C-5) | Before deploy, compare production `_prisma_migrations.checksum` to sha256 of each local migration file; align or re-baseline. Do not deploy with mismatched applied migrations. | Deployer / DBA |
| H-02 | HIGH | C | Unverifiable applied-migration state: raw.json latest applied = `20261001202400_restrict_order_items_product_fk` (25 distinct applied); DEPLOYMENT.md section 2 claims production has 32 applied incl. `20261019000000_seller_os_money_view` finished 2026-10-20. Pending set is either 2 migrations (only the ledger pair) or 8 migrations (including 6 seller-os/influencer migrations). If production lacks `20261008010000_add_returns_refunds_payout_ledger` but already contains `vendor_balance_adjustments` (drift), its `CREATE TABLE` fails and deploy aborts. | backups/prisma-migrations-raw.json vs docs/corrective-ledger/DEPLOYMENT.md:42,46-48 | Query production `_prisma_migrations` (names, finished_at, rolled_back_at) and `information_schema.tables/columns` for vendor_balance_adjustments before deploy. | Deployer / DBA |
| H-03 | HIGH | D | No deploy configuration in repo: no railway.json, Procfile, nixpacks.toml, Dockerfile, .github/workflows. Deploy branch, restart policy and healthcheck cannot be verified from the repo. `start` = `prisma migrate deploy && node server-entry.js` (package.json:9): if migrate deploy fails or times out, node never starts, container exits, restart loop -> unbounded downtime until fixed. | package.json:9; root directory listing | Confirm Railway dashboard: deploy branch, restart policy, healthcheck. Document what `npm start` failure looks like in your runbook. | Deployer / Ops |
| H-04 | HIGH | D | Production build not verifiable: `npm run build` got past `prisma generate` (Prisma Client v7.6.0 generated offline with dummy DATABASE_URL) but `next build` did not complete within the 10-minute verification cap. Whether next build succeeds or any route performs build-time database access is unknown. | Temp\kilo\build.log tail | Complete the production build (CI or local, dummy DATABASE_URL only) before deploy. | Deployer |
| M-01 | MEDIUM | C | `prisma/migrations/migration_lock.toml` is stale: lists nonexistent `20260823000000_privacy_gap_remediation` (actual dir `20260908230000_privacy_gap_remediation`) and omits 6 applied migrations (`20260916133000...` through `20261001202400`). Does not match raw.json or working tree. Does not block `migrate deploy` (reads `_prisma_migrations` table) but makes drift detection unreliable. | prisma/migrations/migration_lock.toml:5-6 vs backups/prisma-migrations-raw.json | Human to regenerate or correct the lock file outside this read-only audit. Not a deploy blocker. | Deployer |
| M-02 | MEDIUM | A | The active ledger wiring exists only in uncommitted working-tree changes: `lib/feature-flags.ts`, `lib/refunds/refund-service.ts`, `lib/webhooks/refund-webhook-handler.ts` modified + `lib/ledger/shadow-hook.ts`, `lib/ledger/reconcile.ts`, tests untracked. The 3 commits ship the migrations + schema + dormant ledger code only (no call sites in committed code). No runtime behavior change after this deploy; if active shadow writes are intended, `shadow-hook.ts` (untracked) must be added to the push set — committing the working-tree changes without it would break the build (missing module). | git status; git show HEAD:lib/refunds/refund-service.ts (no clawback refs); untracked lib/ledger/shadow-hook.ts | Decide intent: push the working tree in full (including shadow-hook.ts) or accept a dormant ledger deploy. | Developer |
| M-03 | MEDIUM | F | Backup gap confirmed: `scripts/backup-production.ts` MODELS omits `VendorBalanceAdjustment`, `Refund`, `ReturnRequest` (lines 8-135). No backup of money tables; runbook itself flags this (DEPLOYMENT.md section 3.1). Harmless for this deploy only because `vendor_balance_adjustments` is empty (claim unverified). | scripts/backup-production.ts:8-135; DEPLOYMENT.md:80-91 | Extend backup or take a database-level backup (Railway snapshot + pg_dump) before deploy. | Deployer / DBA |
| M-04 | MEDIUM | C | `vendor_balance_adjustments` row count is not in backups/row-counts-before.json, so lock duration and NOT NULL re-add risk cannot be estimated from allowed evidence. Runbook claims 0 rows (unverifiable). | backups/row-counts-before.json (no such key) | Confirm table empty in production (read-only count) together with H-02. | DBA |
| L-01 | LOW | B | Tracked `.sql` files outside prisma/migrations: `docs/archive/scripts/*.sql` (12 DDL snippets, e.g. add-category-products-enum.sql, create-failed-email-table.sql). Not part of the deploy path (nothing in package.json build/start runs them); review content before any operational use. | git ls-files | Confirm no deploy step references them; archive or move out of repo if not needed. | Developer |
| L-02 | LOW | A | Large tracked binaries increase clone/deploy payload: `public/assets/videos/marketplace.MOV` 61,840,762 bytes; `app/icon.png` + 3 copies 1,325,019 bytes each; `public/videos/newvideo.mp4` 3,036,195 bytes. None changed by this branch. | file sizes (Get-Item) | Info only; consider git-lfs if clone time becomes an issue. | Developer |
| L-03 | LOW | B | `.gitattribute` is empty (0 bytes) and misnamed (Git reads `.gitattributes`): no line-ending normalisation active, so migration file bytes are stored/checked out as committed. Risk only if a `.gitattributes` with `text=auto` is added later. | .gitattribute (0 bytes, listing) | Add `.gitattributes` with `*.sql -text` (or linguist-generated) to pin migration bytes. | Developer |
| I-01 | INFO | A | Committed push set = 3 commits, 19 files, 4673 insertions / 3 deletions. All changes explained by corrective-ledger work (933ea6b) and local-dev-database tooling (e0c6553); nothing from the origin/main merge beyond what is already on origin/main. | git diff --stat origin/main...HEAD | — | — |
| I-02 | INFO | C | `prisma validate` exit 0 (dummy DATABASE_URL). `prisma migrate diff --from-schema <origin/main schema> --to-schema prisma/schema.prisma --script` output equals exactly the two corrective-ledger migrations' statements (ALTER TYPE ADD VALUE, ALTER COLUMN DROP NOT NULL x2, ADD COLUMN x2, 2 indexes); no statement present in one but not the other. | Temp\kilo\diff-from-base.sql | — | — |
| I-03 | INFO | D | `npx tsc --noEmit` exit 0; `npm run lint` no warnings/errors; `npx vitest run`: 89 files / 1078 passed / 5 todo — matches stated baseline exactly. | command output | — | — |
| I-04 | INFO | B/D | `LEDGER_SHADOW_WRITE` defaults OFF (`lib/feature-flags.ts:7-11`: returns false when unset); not in `REQUIRED_ENV_VARS` (`lib/env-validation.ts:7-22`; required are DATABASE_URL and JWT_SECRET only); never set to `true` in any committed file (grep hits only feature-flags.ts:8 read and DESIGN.md docs). | lib/feature-flags.ts:7-11; lib/env-validation.ts:7-22 | — | — |
| I-05 | INFO | B | `git ls-files`: none of `.env`/`.env.*`, `backups/*`, `*.pem`, `*.key`, `*.sql` outside prisma/migrations (except docs/archive DDL, L-01), `node_modules`, `.next`, `Dhreamarket.zip` tracked. `git check-ignore -v` confirms `.env`, `.env.local`, `backups/row-counts-before.json`, `node_modules`, `.next` all ignored; `Dhreamarket.zip` ignored. | git ls-files; git check-ignore -v output | — | — |
| I-06 | INFO | B | Credential scan of tracked files (excluding node_modules, package-lock.json, prisma/migrations): only obvious test fixtures (`sk_test_webhook_route_key_0002` etc. in route tests), docs/archive/AUDIT_REPORT.md placeholder values, README.md:48 example `DATABASE_URL="postgresql://username:password@localhost:5432/dhraverse"`, docs/local-database.md dev URL `dhream_dev:dhream_dev@localhost:5433/dhream_dev` (guarded local-only). No production secret values in tracked files. `.env` itself is untracked and never read. | git grep output | — | — |
| I-07 | INFO | E | `scripts/ledger-reconcile.ts` is not referenced by package.json scripts, build, start, postinstall, prepare, instrumentation or any cron route. Dry-run default; `--apply` required to write; `--i-know-this-is-production` required when NODE_ENV=production; `assertLocalDatabaseUrl` allows only localhost:5433/dhream_dev. Cannot run automatically. | scripts/ledger-reconcile.ts:1-52; package.json scripts | — | — |
| I-08 | INFO | C/F | Pre-existing schema drift (~20 tables, production vs prisma/schema.prisma) is documented; `migrate deploy` applies migration files, not the datamodel, so it neither reconciles nor is blocked by drift per DEPLOYMENT.md section 4.1 (claim unverifiable against production). | DEPLOYMENT.md:158-182 | — | — |

## Section-by-section results

### A — Exactly what will be pushed and deployed
- A-1 Base branch / live commit: **UNVERIFIED**. HEAD e8db692 on `chore/corrective-ledger-foundation`; `origin/main` (8bc10fa) is an ancestor (merge-base = 8bc10fa); branch is 3 commits ahead: e0c6553, 933ea6b, e8db692. Local `production` branch at a07fda4 (origin/production) is 14 commits behind origin/main, 17 behind HEAD (`git rev-list --count production..origin/main` = 14, `production..HEAD` = 17). No railway.json/Procfile/nixpacks.toml/Dockerfile/.github/workflows in repo -> which branch/commit Railway deploys from cannot be determined from the repo.
- A-2 Commits/files on branch vs origin/main: **PASS**. `git log origin/main..HEAD --oneline`: e8db692, 933ea6b, e0c6553. `git diff --name-status origin/main...HEAD`: 19 files (2 migration SQL, schema.prisma, package.json, docs, scripts, tests). Committed size: 4673 insertions, 3 deletions. No single changed file over 1 MB; no binary files changed.
- A-3 Classification: **PASS**. Migration SQL (2), prisma schema (1), scripts (dev-only local-db tooling), tests only (characterization + unit), docs only, config/build (package.json scripts, docker-compose.dev.yml), other. All committed changes explained by corrective-ledger / local-dev-database work; merge content is already on origin/main. Working-tree modifications (DESIGN.md, lib/feature-flags.ts, lib/refunds/refund-service.ts, lib/webhooks/refund-webhook-handler.ts) and untracked files (lib/ledger/*, scripts/ledger-reconcile.ts, tests) are NOT part of the push set unless added (read-only rule: not added).
- A-4 Size/large files: **PASS** (see A-2, L-02).

### B — Data and secrets exposure in git
- B-1 Tracked env/backups/keys/dumps: **PASS** (see I-05; exception docs/archive/scripts/*.sql -> L-01).
- B-2 `git check-ignore -v`: **PASS** — `.env`, `.env.local`, `backups/row-counts-before.json`, `node_modules\package.json`, `.next\server.js` all return ignore rules (.gitignore:34 `.env*`, :66 `/backups`, :4 `/node_modules`, :17 `/.next/`).
- B-3 History add-then-remove: **PASS** — `git log origin/main..HEAD --diff-filter=D --name-only` returns nothing; every commit on the branch adds files only (A e8db692 DEPLOYMENT.md; A 933ea6b 12 files; A e0c6553 6 files).
- B-4 Hard-coded credential scan: **PASS** (see I-06; no production secrets in tracked files).
- B-5 README default credentials / seed in deploy path: **PASS** — README.md:48 is a placeholder example; `prisma/seed.ts` (`db:seed`) is not invoked by build/start/postinstall/prepare (package.json:7-29).
- B-6 `.gitattribute` / line endings: **PASS** with INFO — empty, misnamed file; no normalisation active (see L-03).

### C — Every migration `migrate deploy` would run
- C-1 Applied vs pending: **PASS** (list produced). Applied per backups/prisma-migrations-raw.json: 25 distinct names, latest `20261001202400_restrict_order_items_product_fk` (finished 2026-10-01). Directory `20260727235000_add_service_requests` exists in raw.json (failed, rolled back) but has no directory in the repo. PENDING (8, in name order — `migrate deploy` runs all of them, not only ours):
  1. `20261001203000_add_influencer_account_type`
  2. `20261008000000_add_influencer_perks`
  3. `20261008010000_add_returns_refunds_payout_ledger`
  4. `20261009000000_add_refund_links`
  5. `20261016000000_seller_os_manual_orders`
  6. `20261019000000_seller_os_money_view`
  7. `20261020100000_corrective_ledger_refund_clawback_enum`
  8. `20261020110000_corrective_ledger_refund_clawback_columns`
  Contradiction: DEPLOYMENT.md section 2 claims production has 32 applied incl. `20261019000000_seller_os_money_view` -> pending set may be only the 2 ledger migrations if production state matches DEPLOYMENT.md instead (UNVERIFIED, see H-02).
- C-2 Destructive-statement scan: **PASS** — zero destructive statements across all 8 pending migrations (no DROP/TRUNCATE/DELETE/UPDATE/SET NOT NULL/RENAME/CASCADE; no table rewrite). Per-migration result in the table below.
- C-3 Two corrective-ledger migrations: **PASS**. Migration 7 contains exactly one statement: `ALTER TYPE "AdjustmentType" ADD VALUE IF NOT EXISTS 'REFUND_CLAWBACK'` (alone in its directory). Migration 8 only: `ALTER COLUMN appliedPayoutId DROP NOT NULL`, `ALTER COLUMN appliedAt DROP NOT NULL`, `ADD COLUMN idempotencyKey TEXT`, `ADD COLUMN currency TEXT NOT NULL DEFAULT 'GHS'`, `CREATE UNIQUE INDEX ... idempotencyKey_key`, `CREATE INDEX ... storeId_appliedPayoutId_idx`. Table `vendor_balance_adjustments` row count unknown (not in backups; runbook claims 0, unverified H-02/M-04). FK `vendor_balance_adjustments_appliedPayoutId_fkey` remains ON DELETE RESTRICT (schema.prisma:2658-2679 `onDelete: Restrict`, migration 20261008010000:179).
- C-4 Naming/ordering: **PASS** — all 8 new directories follow the 14-digit convention and sort after the latest applied (`20261001202400`). Applied `20260801_loyalty_rewards_system` breaks the convention but is already applied, so `migrate deploy` is unaffected. `migrate deploy` applies pending migrations in name order; no new migration sorts before an applied one.
- C-5 Checksums: **FAIL-class finding H-01** — sha256 of working-tree `migration.sql` vs recorded checksums: 15/25 match; 10 mismatch (see H-01 detail). `migrate deploy` drift behavior: if production records the same checksums as raw.json, the deploy aborts on the first mismatched applied migration and no pending migration runs -> app may not start. Unverified against production.
- C-6 `migration_lock.toml`: **PASS** (unchanged, provider = postgresql) with staleness note M-01.
- C-7 Offline schema verification: **PASS** — `npx prisma validate` exit 0; `npx prisma migrate diff --from-schema <origin/main:prisma/schema.prisma> --to-schema prisma/schema.prisma --script` exit 0 and output equals the two ledger migrations exactly (see I-02).
- C-8 No reset/push/force-reset in deploy path: **PASS** — grep for `migrate reset|db push|accept-data-loss|force-reset` (excluding node_modules, package-lock.json, prisma/migrations) shows only package.json:13 `db:push` script (dev-only, not invoked by build/start/postinstall/prepare) and DESIGN.md/docs statements that they were not run.

### D — Deploy, build and startup path
- D-1 Install/build/boot inventory: **PASS** — `postinstall`/`prepare` = `prisma generate` (schema only, no DB); `build` = `prisma generate && next build && node scripts/copy-static.js` (copy-static.js: local file copies only); `start` = `prisma migrate deploy && node server-entry.js`; server-entry.js requires `.next/standalone/server.js` only; instrumentation.ts reads env and starts Sentry only; middleware.ts no DB. Nothing at boot writes, seeds, backfills or deletes data.
- D-2 `migrate deploy` failure: **PASS** (analysis) — `&&` short-circuits, `node server-entry.js` never runs, container exits; restart behaviour depends on Railway restart policy (unknown H-03); downtime unbounded until fixed. No healthcheck visible in repo (UNVERIFIED). Expected lock duration of the ledger migrations: milliseconds each (ACCESS EXCLUSIVE on enum type; empty-table catalog changes; indexes on empty table).
- D-3 Env validation: **PASS** — `LEDGER_SHADOW_WRITE` optional (not in REQUIRED_ENV_VARS); absence cannot crash boot (`isLedgerShadowWriteEnabled` returns false). No new required env var introduced by the branch (env-validation.ts unchanged).
- D-4 `LEDGER_SHADOW_WRITE` not true: **PASS** — grep across tracked files: only feature-flags.ts:8 (read) and DESIGN.md docs; not in any deploy config (none exist).
- D-5 Static checks: **PASS** — tsc exit 0; lint clean; vitest 89 files / 1078 passed / 5 todo (matches baseline).
- D-6 Production build: **UNVERIFIED** — `prisma generate` OK offline with dummy DATABASE_URL (Prisma Client v7.6.0); `next build` started but hit the 10-minute cap (Temp\kilo\build.log). No database connection was attempted anywhere. Complete build before deploy (H-04).

### E — Runtime behaviour of changed application code
- E-1 Unset-flag behaviour: **PASS** — committed app code differs from origin/main in zero production files (refund-service.ts / webhook-handler.ts changes are uncommitted working tree). With `LEDGER_SHADOW_WRITE` unset, `recordClawbackAfterSettlement` returns before any DB call (`lib/ledger/shadow-hook.ts:27`); runtime behaviour identical (error propagation, return values, await ordering unchanged).
- E-2 Ordering in createRefund: **PASS** — `prisma.refund.update(... status: 'PROCESSED' ...)` at lib/refunds/refund-service.ts:565-573 runs BEFORE `recordClawbackAfterSettlement(prisma, row.id)` at line 583; the hook sees the committed PROCESSED row (update is autocommitted outside the transaction).
- E-3 Hook safety: **PASS** — all 3 call sites (refund-service.ts:583, 877, 1156; refund-webhook-handler.ts:187) are outside any `$transaction` callback, are awaited, `recordClawbackAfterSettlement` catches all errors and never throws/rejects (`shadow-hook.ts:29-34`), issues a single ledger query only when flag ON, no indefinite hang (no loops/timeouts needed), zero queries when flag off.
- E-4 No other production areas changed: **PASS** — nothing under app/api/vendor/payouts/, payout eligibility, order status transitions, checkout, cart, non-refund webhooks or cron routes changed vs base (only 2 characterization TEST files added under app/api/vendor/payouts/ in 933ea6b).
- E-5 Dangerous data operations in diff: **PASS** — none in production code (only test mocks `vi.fn()` and `SELECT ... FOR UPDATE` read-locks in the working tree). No `$executeRaw`/`$queryRaw` with DELETE/UPDATE/TRUNCATE/DROP/ALTER; no new cron/admin mutating routes in the diff.
- E-6 `scripts/ledger-reconcile.ts`: **PASS** — cannot run automatically (see I-07); guards confirmed by reading (dry-run default, --apply, --i-know-this-is-production). Not run.
- E-7 scripts/ DB access: **PASS** — DB-connecting scripts (backup-production.ts, local-db.mjs, and others) are not referenced from build/start/postinstall/prepare/instrumentation/cron.

### F — Rollback and recovery readiness
- F-1 Rollback steps correct: **PASS** — `ALTER TYPE ... ADD VALUE` cannot be removed (PostgreSQL); safe recovery is to leave `REFUND_CLAWBACK` in place and unused (DESIGN.md 7.2). Re-adding NOT NULL on `appliedPayoutId`/`appliedAt` fails while any row has NULL -> must backfill/delete such rows first (or leave nullable). Manual rollback SQL documented in DESIGN.md 7.2.
- F-2 Feature off: **PASS** — unset `LEDGER_SHADOW_WRITE` or set it to `false`; takes effect on restart (env read per request), no rebuild required on this platform (not a build-time flag).
- F-3 Code rollback over applied migrations: **PASS** — old code does not reference the new columns or enum value; changes are additive/relaxing, so the previous commit is compatible with the new schema. Runbook section 1: deploy e0c6553 to roll the code back; no schema rollback needed while dormant.
- F-4 Backup scope: **PASS** (finding M-03) — confirmed omissions: VendorBalanceAdjustment, Refund, ReturnRequest; runbook flags gap; harmless for this deploy only if vendor_balance_adjustments is empty (unverified).
- F-5 Pre-deploy checklist and post-deploy read-only verification: **PASS** — produced in "Safe deploy runbook" below (checks written, not executed).

## Pending migrations that `migrate deploy` will run (with destructive-scan result)

Applied baseline (from backups/prisma-migrations-raw.json): 25 distinct migrations, latest `20261001202400_restrict_order_items_product_fk`.

| # | Migration | Destructive statements | Lock level / duration estimate | Reversible? | Row counts (row-counts-before.json) |
|---|---|---|---|---|---|
| 1 | 20261001203000_add_influencer_account_type | None: `ALTER TYPE Role ADD VALUE 'INFLUENCER'` (no IF NOT EXISTS -> errors if value exists), `ADD COLUMN userId TEXT` (nullable), `CREATE UNIQUE INDEX` (not CONCURRENTLY, table 1 row), `ADD CONSTRAINT FK` -> users | ACCESS EXCLUSIVE on Role type briefly; users SHARE ROW EXCLUSIVE during FK validation; milliseconds | Enum value not reversible; rest yes | influencers 1, users 70 |
| 2 | 20261008000000_add_influencer_perks | None: all `ADD COLUMN IF NOT EXISTS`, indexes `IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS influencer_cashbacks`, `ADD VALUE IF NOT EXISTS` on CashbackSource | Milliseconds; small tables | Enum value not reversible | users 70, vendor_subscriptions 49, influencers 1 |
| 3 | 20261008010000_add_returns_refunds_payout_ledger | None: 5 `CREATE TYPE`, 7 `CREATE TABLE` (all new/empty), 13 indexes, 11 `ADD CONSTRAINT FK` (validates existing rows) | FK validation takes SHARE ROW EXCLUSIVE briefly on referenced tables (payments 6, users 70, order_items 6, vendor_payouts 0, stores 41); `vendor_balance_adjustments` row count unknown (not in backup) | Yes (drop tables/columns) | vendor_balance_adjustments: NOT LISTED |
| 4 | 20261009000000_add_refund_links | None: `ADD COLUMN IF NOT EXISTS` x5 (`currency` NOT NULL DEFAULT 'GHS'), indexes IF NOT EXISTS, 3 FKs | Milliseconds (refunds empty) | Yes | refunds: NOT LISTED |
| 5 | 20261016000000_seller_os_manual_orders | None: `CREATE TYPE` x2, `ADD COLUMN` x6 (`source` NOT NULL DEFAULT 'ONLINE'), `ALTER COLUMN userId DROP NOT NULL` (relaxing), `CREATE TABLE vendor_customers`, indexes, 2 FKs | Milliseconds (orders 6 rows) | Yes | orders 6 |
| 6 | 20261019000000_seller_os_money_view | None: 4x `ADD COLUMN costPrice` (nullable, no default) | Milliseconds | Yes | products 129, product_variants 15, orders 6, order_items 6 |
| 7 | 20261020100000_corrective_ledger_refund_clawback_enum | None: `ALTER TYPE AdjustmentType ADD VALUE IF NOT EXISTS 'REFUND_CLAWBACK'` | ACCESS EXCLUSIVE on AdjustmentType type, milliseconds | NOT reversible (enum value permanent) | vendor_balance_adjustments: NOT LISTED |
| 8 | 20261020110000_corrective_ledger_refund_clawback_columns | None: 2x DROP NOT NULL, ADD COLUMN idempotencyKey TEXT, ADD COLUMN currency NOT NULL DEFAULT 'GHS', 2 indexes (not CONCURRENTLY; table empty per runbook claim, unverified) | ACCESS EXCLUSIVE briefly on vendor_balance_adjustments; milliseconds | Columns droppable; NOT NULL re-add blocked if NULL rows exist | vendor_balance_adjustments: NOT LISTED |

Total destructive statements across all 8 pending migrations: **0**.

## Exact list of commits and files that will be pushed

Commits on top of `origin/main` (8bc10fa): `e0c6553` (chore(dev): local Postgres stack), `933ea6b` (chore(ledger): dormant corrective ledger), `e8db692` (docs(ledger): DEPLOYMENT.md runbook).

Files (`git diff --name-status origin/main...HEAD`):
- A app/api/vendor/payouts/[payoutId]/payout-status.characterization.test.ts (test)
- A app/api/vendor/payouts/payouts.characterization.test.ts (test)
- A docker-compose.dev.yml (dev config)
- A docs/corrective-ledger/DEPLOYMENT.md (docs)
- A docs/corrective-ledger/DESIGN.md (docs)
- A docs/local-database.md (docs)
- A docs/safety-net/BASELINE.md (docs)
- A docs/safety-net/REFUND_COVERAGE.md (docs)
- A lib/ledger/clawback.test.ts (test)
- A lib/ledger/clawback.ts (dormant lib)
- A lib/ledger/corrective-ledger.test.ts (test)
- A lib/ledger/corrective-ledger.ts (dormant lib)
- A prisma/migrations/20261020100000_corrective_ledger_refund_clawback_enum/migration.sql
- A prisma/migrations/20261020110000_corrective_ledger_refund_clawback_columns/migration.sql
- M prisma/schema.prisma
- M package.json (+5 dev-db scripts)
- A scripts/assert-local-db.mjs (dev guard)
- A scripts/assert-local-db.test.ts (test)
- A scripts/local-db.mjs (dev tool)

Committed size: 4673 insertions, 3 deletions, 19 files. No changed file over 1 MB, no binaries changed.

Not part of the push set (uncommitted, read-only rule): modified `docs/corrective-ledger/DESIGN.md`, `lib/feature-flags.ts`, `lib/refunds/refund-service.ts`, `lib/webhooks/refund-webhook-handler.ts`; untracked `lib/ledger/reconcile.ts`, `lib/ledger/shadow-hook.ts`, `lib/ledger/reconcile.test.ts`, `lib/ledger/shadow-hook.test.ts`, `lib/refunds/ledger-hook-wiring.test.ts`, `scripts/ledger-reconcile.ts` (see M-02).

## UNVERIFIED items and required human action

| # | Item | Human action |
|---|---|---|
| C1 | Which branch/commit Railway deploys from (no deploy config in repo) | Check Railway dashboard; confirm deploy branch and commit |
| C2 | Production `_prisma_migrations` applied names (raw.json: 25 latest 20261001202400 vs DEPLOYMENT.md: 32 latest 20261019000000) | `SELECT migration_name, started_at, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at` on production (read-only) |
| C3 | Production `_prisma_migrations.checksum` vs working-tree file sha256 (checksum drift H-01) | Compare `checksum` column to local sha256; if mismatch -> DO NOT deploy; align first |
| C4 | Whether `vendor_balance_adjustments` table/columns already exist in production (drift) | `SELECT * FROM information_schema.tables/columns` for vendor_balance_adjustments (read-only) |
| C5 | Railway restart policy / healthcheck | Railway dashboard |
| C6 | `next build` completion and any build-time DB access | Run `npm run build` with dummy DATABASE_URL only (CI or local) |
| C7 | `vendor_balance_adjustments` row count | `SELECT count(*) FROM vendor_balance_adjustments` (read-only) |

## Safe deploy runbook (read-only; write nothing, execute nothing)

Pre-deploy (human only):
1. Railway dashboard: take a Postgres backup; take a `pg_dump` from a machine with PostgreSQL client (the JSON export in backups/ is a row-level fallback, no DDL, not restorable with pg_restore). Both flagged outstanding in DEPLOYMENT.md section 3.2.
2. Confirm deploy branch/commit in Railway dashboard (C1).
3. Run the read-only production checks C2-C4. Abort if `_prisma_migrations` does not match the repo names+checksums, or if `vendor_balance_adjustments` already exists in a conflicting state.
4. Extend/verify backups to cover money tables (M-03) or accept the gap.
5. Pick a quiet hour; assign someone to watch Railway logs and the `migrate deploy` output.
6. Confirm `LEDGER_SHADOW_WRITE` is unset/`false` in Railway env (not set to true anywhere).

Deploy:
7. Trigger deploy. `npm start` runs `prisma migrate deploy` then `node server-entry.js`. Expect migrate deploy to apply exactly the pending migrations from section C (2 if production matches DEPLOYMENT.md, 8 if it matches raw.json), in name order, each in its own transaction. Expected output: "Applying migration ..." for each, then "Done". Any "checksum mismatch" or "already exists" error -> stop, do not proceed, page on-call.
8. If migrate deploy fails: container exits -> Railway restarts per policy (confirm H-03). Downtime until fixed or rollback (redeploy previous commit; schema additive, safe).

Post-deploy (read-only verification only — do not execute writes):
9. `SELECT count(*) FROM vendor_balance_adjustments` (expect 0).
10. `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'AdjustmentType'::regtype` (expect CHARGEBACK, FEE_CORRECTION, MANUAL, REFUND_CLAWBACK).
11. `information_schema.columns` for vendor_balance_adjustments.appliedPayoutId/appliedAt (expect nullable), idempotencyKey, currency DEFAULT 'GHS'.
12. `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name LIKE '20261020%'` (expect both new rows, finished_at set, rolled_back_at null).
13. App responds to healthcheck/requests; error logs empty.

Rollback (feature off): unset `LEDGER_SHADOW_WRITE` / set `false` on Railway -> restart (no rebuild). Code rollback: redeploy previous commit; no schema rollback required while ledger dormant. Enum value `REFUND_CLAWBACK` cannot be removed from PostgreSQL; leave it unused (DESIGN.md 7.2).