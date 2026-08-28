-- Add setupComplete column to stores table
-- Run with: node _scripts/run-add-store-setup-complete.ts
-- Or: psql "$DATABASE_URL" -f _scripts/add-store-setup-complete.sql

ALTER TABLE stores ADD COLUMN IF NOT EXISTS "setupComplete" BOOLEAN DEFAULT FALSE;

UPDATE stores
SET "setupComplete" = TRUE
WHERE
  name IS NOT NULL
  AND TRIM(name) <> ''
  AND LOWER(TRIM(name)) NOT IN ('my store', 'my shop', 'untitled store', 'untitled shop', 'store', 'shop')
  AND description IS NOT NULL
  AND TRIM(description) <> ''
  AND "categoryId" IS NOT NULL
  AND "mainPhoneNumber" IS NOT NULL
  AND TRIM("mainPhoneNumber") <> ''
  AND location IS NOT NULL
  AND TRIM(location) <> '';
