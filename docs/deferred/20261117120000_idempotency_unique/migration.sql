-- Duplicate check (run first):
-- SELECT "idempotencyKey", COUNT(*) FROM "orders" WHERE "idempotencyKey" IS NOT NULL GROUP BY "idempotencyKey" HAVING COUNT(*) > 1;

DROP INDEX IF EXISTS "idx_orders_idempotencyKey";
CREATE UNIQUE INDEX "idx_orders_idempotencyKey" ON "orders" ("idempotencyKey");