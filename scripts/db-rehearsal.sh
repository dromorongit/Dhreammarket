#!/usr/bin/env bash
# Local rehearsal harness: proves a fresh-ish database can be brought up to
# schema parity using only committed migrations + hand-loaded SQL dumps.
#
# Dumps are produced in a SEPARATE shell with the production URL set only for
# that session (Git Bash or WSL; never use PowerShell > redirection). This
# script must be run from a shell that has no production variables set.
#
# Dump commands (run in that isolated session):
#   pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > schema.sql
#   pg_dump --data-only --table=_prisma_migrations --no-owner --no-privileges "$DATABASE_URL" > migrations.sql
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# URL variables are parsed as URLs; PGHOST is compared directly; other PG* are unset.
URL_VARS=(DATABASE_URL DIRECT_URL DATABASE_PUBLIC_URL POSTGRES_URL SHADOW_DATABASE_URL)

for v in "${URL_VARS[@]}"; do
  val="${!v:-}"
  if [ -z "$val" ]; then
    echo "db-rehearsal: $v=(unset)"
    continue
  fi
  host="$(VAL="$val" node -e '
    const v = process.env.VAL || "";
    let u = null;
    try { u = new URL(v); } catch {
      try { u = new URL(v.includes("://") ? v : "//" + v); } catch { u = null; }
    }
    if (!u || !u.hostname) process.stdout.write("__UNPARSEABLE__");
    else process.stdout.write(u.hostname.toLowerCase());
  ' 2>/dev/null || printf '%s' '__UNPARSEABLE__')"
  if [ "$host" = "__UNPARSEABLE__" ]; then
    echo "db-rehearsal: $v host=(unparseable)"
    exit 1
  fi
  echo "db-rehearsal: $v host=${host}"
  if [ "$host" != "localhost" ] && [ "$host" != "127.0.0.1" ]; then
    echo "db-rehearsal: refusing to run: $v resolves to non-local host" >&2
    exit 1
  fi
done

# PGHOST compared directly; other PG* variables are unset.
if [ -n "${PGHOST:-}" ]; then
  echo "db-rehearsal: PGHOST host=${PGHOST}"
  if [ "$PGHOST" != "localhost" ] && [ "$PGHOST" != "127.0.0.1" ]; then
    echo "db-rehearsal: refusing to run: PGHOST resolves to non-local host" >&2
    exit 1
  fi
fi
unset PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGCONNECT_TIMEOUT DIRECT_URL DATABASE_PUBLIC_URL POSTGRES_URL SHADOW_DATABASE_URL
export DATABASE_URL="postgresql://dhream_dev:dhream_dev@localhost:5433/dhream_dev?schema=public"

HOST="$(node -e 'process.stdout.write(new URL(process.env.DATABASE_URL).hostname)')"
echo "db-rehearsal: using host=${HOST}"

PSQL=(docker exec -i dhream-dev-postgres psql -U dhream_dev -d dhream_dev -v ON_ERROR_STOP=1)

# Start the dev Postgres on 5433.
echo "db-rehearsal: host=${HOST} step=start-postgres"
docker compose -f docker-compose.dev.yml up -d

# Wait for healthy.
for _ in $(seq 1 60); do
  status="$(docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" dhream-dev-postgres 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 2
done
status="$(docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" dhream-dev-postgres 2>/dev/null || true)"
if [ "$status" != "healthy" ]; then
  echo "db-rehearsal: postgres did not become healthy" >&2
  exit 1
fi

# Verify 5433 is mapped to the container right after healthy.
echo "db-rehearsal: host=${HOST} step=port-check"
if ! docker port dhream-dev-postgres 5432/tcp 2>/dev/null | grep -q '5433'; then
  echo "db-rehearsal: port 5433 is not mapped to the container" >&2
  exit 1
fi

echo "db-rehearsal: host=${HOST} step=server-version"
"${PSQL[@]}" -Atc "SHOW server_version;"

echo "db-rehearsal: host=${HOST} step=current-database"
db_name="$("${PSQL[@]}" -Atc "SELECT current_database();")"
if [ "$db_name" != "dhream_dev" ]; then
  echo "db-rehearsal: refusing to run: current_database is ${db_name}" >&2
  exit 1
fi

# Load hand-provided SQL dumps from the repo root (gitignored).
for f in schema.sql migrations.sql; do
  if [ ! -f "$f" ]; then
    echo "db-rehearsal: missing required $f in repo root" >&2
    exit 1
  fi
done

# Reset local schema after host check.
echo "db-rehearsal: host=${HOST} step=reset-schema"
"${PSQL[@]}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "db-rehearsal: host=${HOST} step=load-schema.sql"
"${PSQL[@]}" < schema.sql

echo "db-rehearsal: host=${HOST} step=load-migrations.sql"
"${PSQL[@]}" < migrations.sql

failed=0

# Checksum comparison (before deploy). Mismatch is a failure.
echo "db-rehearsal: host=${HOST} step=checksums"
echo "db-rehearsal: note: CRLF line endings in migration.sql can cause a false mismatch"
compared=0
pending=0
checksum_failed=0
for f in prisma/migrations/*/migration.sql; do
  dir="$(basename "$(dirname "$f")")"
  file_hash="$(sha256sum "$f" | awk '{print $1}')"
  if ! query_output="$("${PSQL[@]}" -Atc "SELECT checksum FROM _prisma_migrations WHERE migration_name='${dir}' LIMIT 1;" 2>&1)"; then
    echo "db-rehearsal: checksum query error for ${dir}: ${query_output}"
    checksum_failed=1
    continue
  fi
  db_hash="${query_output}"
  if [ -z "$db_hash" ]; then
    pending=$((pending + 1))
    continue
  fi
  compared=$((compared + 1))
  if [ "$file_hash" != "$db_hash" ]; then
    echo "db-rehearsal: CHECKSUM MISMATCH ${dir}: file=${file_hash} db=${db_hash}"
    checksum_failed=1
  fi
done
echo "db-rehearsal: checksums compared=${compared} pending-not-in-db=${pending}"
if [ "$compared" -eq 0 ]; then
  echo "db-rehearsal: no checksums compared; failing"
  checksum_failed=1
fi
if [ "$checksum_failed" -ne 0 ]; then
  failed=1
else
  echo "db-rehearsal: all compared checksums match"
fi

# Prisma checks.
echo "db-rehearsal: host=${HOST} step=prisma-migrate-status (informational)"
npx prisma migrate status || true

echo "db-rehearsal: host=${HOST} step=prisma-migrate-deploy"
if ! npx prisma migrate deploy; then
  echo "db-rehearsal: prisma migrate deploy failed"
  failed=1
fi

echo "db-rehearsal: host=${HOST} step=prisma-migrate-status (required)"
if ! npx prisma migrate status; then
  echo "db-rehearsal: prisma migrate status failed after deploy"
  failed=1
fi

echo "db-rehearsal: host=${HOST} step=prisma-migrate-diff"
if ! npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code; then
  echo "db-rehearsal: prisma migrate diff failed"
  failed=1
fi

# DB-backed tests (each file separately).
for t in \
  "prisma/__tests__/sla-deadline-trigger.test.ts" \
  "lib/orders/mark-order-paid.test.ts" \
  "prisma/__tests__/verification-backfill.test.ts"; do
  echo "db-rehearsal: host=${HOST} step=vitest file=${t}"
  if ! npx vitest run "$t"; then
    echo "db-rehearsal: vitest failed for ${t}"
    failed=1
  fi
done

echo "db-rehearsal: host=${HOST} summary"
if [ "$failed" -ne 0 ]; then
  echo "db-rehearsal: ONE OR MORE STEPS FAILED"
  exit 1
fi
echo "db-rehearsal: ALL STEPS PASSED"
