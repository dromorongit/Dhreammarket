# Ways of Working — Database Migrations

## Required step after any manual migration

The production boot script runs `prisma migrate deploy` automatically. If you bypass `prisma migrate deploy` and apply a migration manually — for example, with `scripts/apply-influencer-migration.ts` or any raw SQL runner — you must mark the migration as applied in Prisma's tracking table before the next deploy:

```bash
npx prisma migrate resolve --applied <migration_name>
```

If you skip this step, the boot script will try to re-apply the same migration and fail with error `42710` (constraint already exists) or `P3009` / `P3018`. The official recovery path is `prisma migrate resolve --applied`, not editing `migration.sql` to add `IF NOT EXISTS` after the fact.

Reference: https://pris.ly/d/migrate-resolve

## Idempotency for future manually-written migrations

For any future manual migration that uses `ALTER TABLE ADD CONSTRAINT`, consider wrapping constraint creation in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` because Postgres does not support `IF NOT EXISTS` for constraints. `IF NOT EXISTS` IS available for `CREATE TABLE` and indexes, but not for `ALTER TABLE ADD CONSTRAINT`.
