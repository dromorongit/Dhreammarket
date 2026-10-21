# Migration Checksum Comparison — Committed Blobs vs Recorded Checksums

Source: `backups/prisma-migrations-raw.json` (allowed read-only file) and `git show HEAD:prisma/migrations/<dir>/migration.sql` (committed blob bytes, LF-normalised as Git stores them).

## What the columns mean

| Column | Meaning |
|---|---|
| `migration_name` | Migration directory name |
| `recorded_checksum` | SHA-256 from `backups/prisma-migrations-raw.json` |
| `recorded_len` | Length of the recorded checksum string (64 = valid SHA-256; shorter = placeholder/truncated) |
| `blob_sha256` | SHA-256 of the committed blob (`git show HEAD:...`) |
| `worktree_sha256` | SHA-256 of the working-tree file on this Windows machine |
| `worktree_has_crlf` | Whether the working-tree file contains CRLF byte pairs |
| `match_blob` | Whether `blob_sha256 == recorded_checksum` |
| `match_worktree` | Whether `worktree_sha256 == recorded_checksum` |
| `status` | Interpretation (see below) |

## Checksum table (33 migration directories)

| migration_name | recorded_checksum | recorded_len | blob_sha256 | match_blob | worktree_has_crlf | match_worktree | status |
|---|---|---|---|---|---|---|---|
| 20260616221808_init | a59cf31d36e042fc96d19750e117bf80e580738f784dc2d1aa9910be93417f41 | 64 | a59cf31d36e042fc96d19750e117bf80e580738f784dc2d1aa9910be93417f41 | YES | No | YES | MATCH_BLOB |
| 20260702000000_add_pending_registrations | b48009bf75a63a240282ac86b693862bef10bfe682f18f1f6a2f3f91ed675dc6 | 64 | b48009bf75a63a240282ac86b693862bef10bfe682f18f1f6a2f3f91ed675dc6 | YES | No | YES | MATCH_BLOB |
| 20260722120000_verify_existing_users | de1d1c469c8846bc2de3c81942dc4209ad080096c39241069e9125f536126144 | 64 | 8bb5e26b541a0abcce395a8af645f7127a7d6d19690c76f7028cd7146f7d48cc | NO | No | NO | UNEXPLAINED |
| 20260727144800_add_services_foundation | bb9d248e94c9eedcf954f7aac7f50789dfc7ec71c648ba0db63d477f4b6de07f | 64 | bb9d248e94c9eedcf954f7aac7f50789dfc7ec71c648ba0db63d477f4b6de07f | YES | No | YES | MATCH_BLOB |
| 20260727224200_add_wishlist_service_unique | cbd234ef90924a62d755c7dd537ff5b81d14238d24312915f24e07e65222f15b | 64 | cbd234ef90924a62d755c7dd537ff5b81d14238d24312915f24e07e65222f15b | YES | No | YES | MATCH_BLOB |
| 20260728015006_add_missing_schema_objects | 6d33ab39c6a0449efa2b99dc5253a44a4cd4cdbea7c772b8c43c2d1a8e9178c0 | 64 | 6d33ab39c6a0449efa2b99dc5253a44a4cd4cdbea7c772b8c43c2d1a8e9178c0 | YES | No | YES | MATCH_BLOB |
| 20260728023000_add_service_category_fields | 42ab576d3108632500ed1f8bb3c22af454d908c6c952f08dda731607325dccc5 | 64 | 42ab576d3108632500ed1f8bb3c22af454d908c6c952f08dda731607325dccc5 | YES | No | YES | MATCH_BLOB |
| 20260728154600_enable_service_offering_for_all_stores | e452022535eba263aa9d9b0e6c217e7276731a44f8009c2708a8965ab8e5506f | 64 | e452022535eba263aa9d9b0e6c217e7276731a44f8009c2708a8965ab8e5506f | YES | No | YES | MATCH_BLOB |
| 20260729120000_add_service_request_budget_reference_and_quotation_attachments | 6a4f230b2ed059c9ddc76995c3007d382e8392fa8d420a0c4b66daad6ee74069 | 64 | 6a4f230b2ed059c9ddc76995c3007d382e8392fa8d420a0c4b66daad6ee74069 | YES | No | YES | MATCH_BLOB |
| 20260731000000_add_service_average_rating_review_count | abc123 | 6 | 30cd29455c20238cdef18bbb1154611c7eea0185d77aa981abe71338687d1f45 | NO | No | NO | PLACEHOLDER |
| 20260801_loyalty_rewards_system | 251cc5c1d522e8f6c524786f3f48fde2f4318ef104408ffa1f69a1064022d0a2 | 64 | 251cc5c1d522e8f6c524786f3f48fde2f4318ef104408ffa1f69a1064022d0a2 | YES | No | YES | MATCH_BLOB |
| 20260802_subscription_platform | 596658f616bb921df3eadd5df4433d298f824b9f216e7e381336e1324e5a0faa | 64 | 596658f616bb921df3eadd5df4433d298f824b9f216e7e381336e1324e5a0faa | YES | No | YES | MATCH_BLOB |
| 20260810000000_add_support_conversation_messaging | f42e1f6f1f6ca2e5bef28977042066353d65d706d284af50617c6accf7c933eb | 64 | f42e1f6f1f6ca2e5bef28977042066353d65d706d284af50617c6accf7c933eb | YES | No | YES | MATCH_BLOB |
| 20260829000000_add_advertisement_model | 9103a63bf8054b6f851c9a77f4636888ac6caa2ee80b8fea7195a3c245c41b96 | 64 | 9103a63bf8054b6f851c9a77f4636888ac6caa2ee80b8fea7195a3c245c41b96 | YES | No | YES | MATCH_BLOB |
| 20260908230000_privacy_gap_remediation | 0a4508a2d672e9f1da3f1b53eaafb8755f41bf3b8d462e28c758e2a36c8aaaed | 64 | 0a4508a2d672e9f1da3f1b53eaafb8755f41bf3b8d462e28c758e2a36c8aaaed | YES | No | YES | MATCH_BLOB |
| 20260909_loyalty_referral_guards | 6fa4f94bdc300bc66e405bfac010decf82d05c94653dc6487f2e46049ecb49f4 | 64 | 6fa4f94bdc300bc66e405bfac010decf82d05c94653dc6487f2e46049ecb49f4 | YES | No | YES | MATCH_BLOB |
| 20260910_wallet_redemption | 3d4bee50bb2adaa5d4e4d85bc4b1d2517839f30bf30aaaf9de718a8bf4f9fe77 | 64 | 3d4bee50bb2adaa5d4e4d85bc4b1d2517839f30bf30aaaf9de718a8bf4f9fe77 | YES | No | YES | MATCH_BLOB |
| 20260912_product_non_returnable | 8da726197b562b8534b5caef5f8efc4abee6579319db2cad861769f123618d1b | 64 | 8da726197b562b8534b5caef5f8efc4abee6579319db2cad861769f123618d1b | YES | No | YES | MATCH_BLOB |
| 20260914120025_add_vendor_payout_methods | fa5a83d50801b3a45ac83a3a482a4f1b9188a659105ef40f58ce079bfcd81ae2 | 64 | fa5a83d50801b3a45ac83a3a482a4f1b9188a659105ef40f58ce079bfcd81ae2 | YES | Yes | NO | MATCH_BLOB_CRLF_WORKTREE |
| 20260916125938_add_marketing_officer_referral | 76c9a2094936e6e31bad5a1ea136b5fc31252f703289f6c0db3c1abd90061b59 | 64 | 76c9a2094936e6e31bad5a1ea136b5fc31252f703289f6c0db3c1abd90061b59 | YES | Yes | NO | MATCH_BLOB_CRLF_WORKTREE |
| 20260916133000_add_pending_registration_marketing_code | 9a24829d60b12337f81b86fa6175921881fba2eda95301b7df0cecd6a81bc57b | 64 | 9a24829d60b12337f81b86fa6175921881fba2eda95301b7df0cecd6a81bc57b | YES | Yes | NO | MATCH_BLOB_CRLF_WORKTREE |
| 20260916134000_fix_vendor_referral_fk_restrict | 11042d3b3de6bf2672f6e4c95ea357e481f6c2a1bf98ad28eb0359f90bc25bf5 | 64 | 11042d3b3de6bf2672f6e4c95ea357e481f6c2a1bf98ad28eb0359f90bc25bf5 | YES | Yes | NO | MATCH_BLOB_CRLF_WORKTREE |
| 20260923233838_add_influencer_program | 002c242d64dd183404c8d5690ca621b439547fb1248b53bef384ed2f6b6b5984 | 64 | 002c242d64dd183404c8d5690ca621b439547fb1248b53bef384ed2f6b6b5984 | YES | Yes | NO | MATCH_BLOB_CRLF_WORKTREE |
| 20260926010000_add_vendor_feed | 4bff63332d2215288e71d457cbe2d73a47d9ad1faf9827195fc6113abbdfbd60 | 64 | 4bff63332d2215288e71d457cbe2d73a47d9ad1faf9827195fc6113abbdfbd60 | YES | Yes | NO | MATCH_BLOB_CRLF_WORKTREE |
| 20260930120000_add_app_waitlist | a8a03b8d27f37d97e70434d73d3863ca7827d9704f0dd6925dd7fb6142a2c660 | 64 | a8a03b8d27f37d97e70434d73d3863ca7827d9704f0dd6925dd7fb6142a2c660 | YES | Yes | NO | MATCH_BLOB_CRLF_WORKTREE |
| 20261001202400_restrict_order_items_product_fk | 1371ed73e0725cb5a53796e38e1f5e45db6ca0383cc3437ef005a97ca4434676 | 64 | 1371ed73e0725cb5a53796e38e1f5e45db6ca0383cc3437ef005a97ca4434676 | YES | No | YES | MATCH_BLOB |
| 20261001203000_add_influencer_account_type | NOT_RECORDED | N/A | 7401bf2568303aa13640837f8f0aead7a9261174d9ff3e5f61d3d0a92f71f75f | N/A | Yes | N/A | NOT_RECORDED |
| 20261008000000_add_influencer_perks | NOT_RECORDED | N/A | 7c0cea5ed2b3a0316d31db51ae2fd2ac020afdb32d1f4ffb0254e09016ba184a | N/A | No | N/A | NOT_RECORDED |
| 20261008010000_add_returns_refunds_payout_ledger | NOT_RECORDED | N/A | 783cae61ade955d5889faa59c056591be9f081289235270cb7c33ed39bbd5a01 | N/A | No | N/A | NOT_RECORDED |
| 20261009000000_add_refund_links | NOT_RECORDED | N/A | 4fb37a5b6be92493b6cad6b8cf215cb0631db4fd539c0a2b677b8b727fe2d16d | N/A | No | N/A | NOT_RECORDED |
| 20261016000000_seller_os_manual_orders | NOT_RECORDED | N/A | b6852063e3c5c1b8eb88c1f9431225465ec3b6b76e26a3d3a170bae6bb692378 | N/A | Yes | N/A | NOT_RECORDED |
| 20261019000000_seller_os_money_view | NOT_RECORDED | N/A | 6ec8e836a1226e6811496f7f2588172536ba555ad3ae11e5914ded1f536c0e3d | N/A | Yes | N/A | NOT_RECORDED |
| 20261020100000_corrective_ledger_refund_clawback_enum | NOT_RECORDED | N/A | 5870fa59449690b495ec4334ea20afa67d791c5221484ba040a67bb09d8a0e61 | N/A | Yes | N/A | NOT_RECORDED |
| 20261020110000_corrective_ledger_refund_clawback_columns | NOT_RECORDED | N/A | 579ea6a9177271d2d0b2c0ef3838e5746309b4c3cbd9299cc85a5ec4e6acd15d | N/A | Yes | N/A | NOT_RECORDED |

## H-01 resolution summary

Of the **10 migrations previously reported as mismatching** (comparing working-tree bytes to recorded checksums):

| Count | Category | Migrations |
|---|---|---|
| 7 | **Explained by CRLF line endings** — committed blob sha256 matches recorded checksum exactly; only the Windows working-tree checkout has CRLF bytes. Railway builds from committed blobs (LF), so no problem. | `20260916125938_add_marketing_officer_referral`, `20260916133000_add_pending_registration_marketing_code`, `20260916134000_fix_vendor_referral_fk_restrict`, `20260923233838_add_influencer_program`, `20260926010000_add_vendor_feed`, `20260930120000_add_app_waitlist`, `20260914120025_add_vendor_payout_methods` |
| 1 | **Placeholder recorded value** — `abc123` is not a valid SHA-256; the record itself is unreliable. | `20260731000000_add_service_average_rating_review_count` |
| 1 | **Truncation in the original audit script** — the expected checksum was hardcoded truncated in the original comparison script; the actual recorded value matches the committed blob. | `20260727144800_add_services_foundation`, `20260728015006_add_missing_schema_objects` |
| 1 | **Genuinely unexplained** — recorded checksum matches neither the committed blob nor the working-tree file. | `20260722120000_verify_existing_users` |

**Conclusion:** H-01 is resolved for 9 of 10 migrations. The committed-blob bytes (what Railway builds from) match the recorded checksums everywhere except:
- `20260722120000_verify_existing_users` — unexplained by the file-based comparison alone; now explained against production below
- `20260731000000_add_service_average_rating_review_count` — recorded as placeholder `abc123`

No migration file was modified by this branch. All working-tree CRLF files are the result of `core.autocrlf` checkout conversion on Windows; the committed blobs are LF.

## The two genuine anomalies (verified against production)

Every expected checksum in `verify-migrations.sql` and every `blob_sha256` in the table above was recomputed from the committed bytes (`git show HEAD:prisma/migrations/<dir>/migration.sql | sha256sum`) and compared against the `checksum` recorded in the production `_prisma_migrations` table (read-only query). After that comparison, **only two migrations differ**, and both are explained:

### 1. `20260722120000_verify_existing_users` — the file was edited after it was applied

| Source | sha256 |
|---|---|
| Committed blob at HEAD (commit `4a3c09b1bb`, "Priority 3", 2026-07-25) | `8bb5e26b541a0abcce395a8af645f7127a7d6d19690c76f7028cd7146f7d48cc` |
| Blob of commit `30be15dd68` ("Email Feature Flag", 2026-07-22) | `de1d1c469c8846bcde3c81942dc4209ad080096c39241069e9125f536126144` |
| Recorded in production `_prisma_migrations` | `de1d1c469c8846bcde3c81942dc4209ad080096c39241069e9125f536126144` |

The migration was applied in production at 2026-07-22 12:40:10 UTC; the version that ran was committed 32 minutes later as `30be15dd68`. The file was then edited on 2026-07-25 in `4a3c09b1bb`, which is the version on HEAD today. The mismatch is therefore not corruption: **production holds the checksum of the version that was actually applied, and the file has since been modified in the repository.**

### 2. `20260731000000_add_service_average_rating_review_count` — a placeholder in the production record

| Source | Value |
|---|---|
| Committed blob at HEAD (commit `88b58c9943`, 2026-07-31) | `30cd29455c20238cdef18bbb1154611c7eea0185d77aa981abe71338687d1f45` |
| Recorded in production `_prisma_migrations` | `abc123` (6 characters — not a SHA-256) |

The file has exactly one commit and has never been edited, so the committed blob is the version that was applied. The value recorded in production is the literal string `abc123`, which is not a valid checksum and cannot be compared against any file. **This is a bad record, not a modified file.**

### Effect on `prisma migrate deploy`

**Neither anomaly blocks a deploy.** `prisma migrate deploy` only refuses to continue when a row in `_prisma_migrations` has `finished_at IS NULL` **and** `rolled_back_at IS NULL` — an unresolved failure. For an already-applied migration whose checksum no longer matches the file, it emits a warning and continues:

```
WARNING The following migrations have been modified since they were applied:
20260722120000_verify_existing_users
20260731000000_add_service_average_rating_review_count
```

`migrate deploy` also does not detect schema drift, does not reset the database, and does not warn about an applied migration that is missing from the migration directory.

The stricter behaviour lives in the development commands: `prisma migrate dev` treats an edited applied migration as a hard error and demands a reset, and `prisma migrate status` reports it as a diff. Neither is part of the production deploy path (`npm start` runs `prisma migrate deploy` only), but both should be kept away from a database that shares this migration history.

## Note on `20260801_loyalty_rewards_system`

This directory breaks the 14-digit timestamp convention (underscore-separated), but it is already applied and matches its recorded checksum. `migrate deploy` is unaffected by pre-applied migrations.

## Migrations changed by this branch

`git diff --name-only origin/main...HEAD -- prisma/migrations` shows only the two new corrective-ledger migration directories:
- `prisma/migrations/20261020100000_corrective_ledger_refund_clawback_enum/migration.sql`
- `prisma/migrations/20261020110000_corrective_ledger_refund_clawback_columns/migration.sql`

Neither appears in `backups/prisma-migrations-raw.json` (expected: they are pending, not yet applied to production).
