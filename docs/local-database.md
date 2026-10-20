# Local development database

A throwaway PostgreSQL for development and integration tests. It never touches
production.

## What it is

`docker-compose.dev.yml` runs one PostgreSQL container:

| Setting | Value |
| --- | --- |
| Image | `postgres:16` |
| Host port | `5433` (container port `5432`) |
| User / password / database | `dhream_dev` / `dhream_dev` / `dhream_dev` |
| Volume | `dhream_dev_pgdata` (named volume, survives `db:dev:down`) |
| Bind address | `127.0.0.1` only, not reachable from the network |

Port `5433` is deliberate: `5432` stays free for a PostgreSQL you may already
have installed locally.

The production PostgreSQL version is not recorded anywhere in this repository,
so the local image tracks the current PostgreSQL default major release, 16.

## Requirements

Docker Desktop (or Docker Engine) with the Compose v2 plugin.

```bash
docker --version
docker compose version
```

## Commands

Always use the `db:dev:*` scripts. They build the local connection string
themselves, run the guard in `scripts/assert-local-db.mjs`, and only then start
docker or prisma.

```bash
npm run db:dev:up       # start postgres, wait until the healthcheck passes
npm run db:dev:status   # prisma migrate status against the local database
npm run db:dev:migrate  # prisma migrate deploy against the local database
npm run db:dev:reset    # drop the volume and recreate an empty database
npm run db:dev:down     # stop the container, keep the volume
```

`db:dev:reset` is the one to use when the schema has drifted: it removes the
volume, so the next `db:dev:migrate` replays every migration against an empty
database.

## .env is production, and db:dev:* never reads it

The `.env` file in this repository holds the production (Railway)
`DATABASE_URL`. The `db:dev:*` scripts do not read `.env` at all: the local URL
is assembled in `scripts/local-db.mjs` from hardcoded localhost values, and it
is passed to prisma as an explicit `DATABASE_URL` for that one process only.

`prisma.config.ts` loads `.env` via `dotenv/config`, but dotenv never
overwrites a variable that is already set in the environment, so the local URL
always wins inside the `db:dev:*` commands.

## Never run bare prisma commands

Do not run `prisma migrate deploy`, `prisma migrate dev`, `prisma db push`,
`prisma db pull`, `prisma studio` or `psql` without an explicit, locally built
`DATABASE_URL`. Those commands read `.env` by default and would connect to the
production database.

The rule in one line: **never run bare prisma commands**. Use `db:dev:*`
instead, or set the URL yourself:

```bash
# correct
npm run db:dev:migrate

# correct, if you really need a bare command
DATABASE_URL="postgresql://dhream_dev:dhream_dev@localhost:5433/dhream_dev" npx prisma migrate status
```

## The guard

`scripts/assert-local-db.mjs` accepts a URL only when the host is `localhost`,
`127.0.0.1` or `::1`, the port is `5433` and the database name is `dhream_dev`.
Anything else exits non-zero. The guard never prints the URL, not even the
part it rejected, so production credentials cannot leak into a log.

```bash
node scripts/assert-local-db.mjs "postgresql://someone:secret@db.example.com:5432/production"
# assert-local-db: refusing to run: the target is not the local development database (the host must be localhost, 127.0.0.1 or ::1)
# exit code 1
```

There is intentionally no `db:dev:studio` script: Prisma Studio can run
destructive actions, and it is not needed for local work.

## Seed script

`prisma/seed.ts` already exists and is wired to `npm run db:seed` and to
Prisma's `seed` config. It seeds the subscription plans only, and it is **not**
guarded: it imports `dotenv/config`, so a plain `npm run db:seed` connects to
the production database. Point it at the local database explicitly when you
need it locally:

```bash
DATABASE_URL="postgresql://dhream_dev:dhream_dev@localhost:5433/dhream_dev" npm run db:seed
```
