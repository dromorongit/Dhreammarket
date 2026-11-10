-- Add refund alert sent timestamps so the pending-refund-alerts cron never
-- notifies twice about the same item.
--
-- refundAlertSentAt on customer_cancellations stamps a cancellation refund
-- request once the pending-refund-alerts cron has alerted about it (no Refund
-- row for the order yet).
-- refundAlertSentAt on refunds stamps a PENDING refund row once the cron has
-- alerted about it (still PENDING after 1 hour).
--
-- Additive migration: nullable columns only, no backfill, no existing tables
-- or columns modified. Existing behaviour is unaffected until the
-- REFUND_ALERT_ENABLED feature flag is switched on.

-- AlterTable: add the refund alert sent timestamp to customer_cancellations.
ALTER TABLE "customer_cancellations" ADD COLUMN "refundAlertSentAt" TIMESTAMP(3);

-- AlterTable: add the refund alert sent timestamp to refunds.
ALTER TABLE "refunds" ADD COLUMN "refundAlertSentAt" TIMESTAMP(3);
