-- Add idempotencyKey column to orders table for checkout deduplication
-- Nullable, indexed, not globally unique across all time.
-- Run with: psql "$DATABASE_URL" -f _scripts/add-order-idempotency-key.sql

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);

COMMENT ON COLUMN orders.idempotency_key IS 'Client-generated idempotency key to prevent duplicate orders on retries within a short window';
