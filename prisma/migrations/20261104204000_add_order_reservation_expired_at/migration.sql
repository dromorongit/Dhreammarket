-- Add order-level reservation expiry tracking (reservationExpiredAt).
--
-- This column marks the moment the expiry cron cancelled an order's stock
-- reservation. It replaces the previous marker stored in vendorRejectionReason
-- ('EXPIRED_RESERVATION'), which leaked into vendor/customer dashboards.
-- handleLatePayment uses reservationExpiredAt IS NOT NULL to distinguish
-- cron-expired orders (eligible for revival via reserveStock) from manual
-- cancellations (which skip reserveStock and go straight to refund).

-- AlterTable: add the nullable reservation expiry timestamp to orders.
ALTER TABLE "orders" ADD COLUMN "reservationExpiredAt" TIMESTAMP(3);
