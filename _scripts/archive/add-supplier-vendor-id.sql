-- Add nullable vendorId column to suppliers table for vendor ownership
-- Nullable to avoid failing on existing rows; backfill handles population
-- Run with: node _scripts/run-add-supplier-vendor-id.ts
-- Or: psql "$DATABASE_URL" -f _scripts/add-supplier-vendor-id.sql

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "vendorId" VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_suppliers_vendorId ON suppliers("vendorId");
