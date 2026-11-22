#!/usr/bin/env bash
set -euo pipefail
docker compose -f docker-compose.dev.yml up -d
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/dhream_market_test"
npx prisma migrate deploy
npx vitest run prisma/__tests__/sla-deadline-trigger.test.ts