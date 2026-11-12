# Migration Authoring Conventions

## Encoding

- Save all `*.sql` migration files as **UTF-8 WITHOUT BOM**.
- **Do not** use PowerShell redirection or cmdlets such as `>`, `Out-File`, or `Set-Content` to create or write `.sql` files — they can introduce a UTF-8 BOM or write UTF-16. Prefer `prisma migrate dev` to generate migrations, or use an editor that writes UTF-8 without BOM.

## Writing Safe Migrations

- Prefer idempotent guards in new migrations where appropriate:
  - `CREATE TABLE IF NOT EXISTS ...`
  - `CREATE INDEX IF NOT EXISTS ...`
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` (PostgreSQL)
  - Use `IF EXISTS` for drops.
- Keep migrations minimal and focused on the intended schema change.

## Immutability

- **Never edit a migration after it has been applied** to any shared or production environment. Prisma stores checksums; modifying an applied migration will cause deploy failures (`P3006`/checksum mismatch).
- If a deployed migration has an issue, create a new corrective migration instead of rewriting history.

## Pre-push Checks

Run these before pushing changes that touch migrations:

```sh
npm run check:migrations
npx vitest run lib/migrations-encoding.test.ts
```

The encoding check fails on UTF-8/UTF-16/UTF-32 BOMs, NUL bytes, or invalid UTF-8 and is also enforced during `npm run build`.
