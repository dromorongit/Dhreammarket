-- Add order-level stock reservation tracking (stockReservedAt).
--
-- This column marks the moment an order's stock was reserved by reserveStock
-- (called from the payment verify endpoint and the Paystack webhook). It is
-- used to make reserve/release idempotent: reserveStock sets it only when it
-- is NULL, and releaseStock clears it only when it is NOT NULL. A non-NULL
-- value therefore means "an active reservation is held for this order".

-- AlterTable: add the nullable reservation timestamp to orders.
ALTER TABLE "orders" ADD COLUMN "stockReservedAt" TIMESTAMP(3);

-- Backfill: mark orders that currently hold an active reservation.
--
-- Condition (inferred from existing data, since stockReservedAt did not exist
-- before this migration): an order holds a reservation when reserveStock was
-- run for it and the reservation has not since been consumed, released, or
-- cancelled. reserveStock runs only after a successful payment
-- (app/api/payment/verify/route.ts:303 and lib/webhooks/order-webhook-handler.ts:257),
-- so we identify reserved orders as those with paymentStatus = 'PAID' that
-- are not cancelled (the release status) and not yet consumed at fulfillment:
--   paymentStatus = 'PAID'
--   status <> 'CANCELLED'          (CANCELLED = reservation already released)
--   source = 'ONLINE'              (MANUAL orders never call reserveStock;
--                                   they consume stock directly via
--                                   consumeManualSaleStock)
--   inventoryConsumedAt IS NULL    (already consumed = stock moved to sold)
--
-- Orders already consumed (inventoryConsumedAt set) are intentionally skipped:
-- their stock was moved from reserved to sold, so there is no active
-- reservation to timestamp. Cancelled orders had their reservation released
-- already (releaseStock), so they get no timestamp. Manual orders never went
-- through reserveStock, so they get no timestamp either.
UPDATE "orders"
SET "stockReservedAt" = now()
WHERE "paymentStatus" = 'PAID'
  AND "status" <> 'CANCELLED'
  AND "source" = 'ONLINE'
  AND "inventoryConsumedAt" IS NULL;
