-- Add nullable vendor completion reminder timestamps to orders.
--
-- completion_reminder_1_at is stamped when the first completion reminder is
-- sent for a delivered order (at least 24 hours after delivery).
-- completion_reminder_2_at is stamped when the second reminder is sent
-- (at least 72 hours after delivery).
-- Stamping happens in the same transaction as creating the reminder
-- notification so an order can never be reminded twice for the same reminder.
-- No backfill: existing orders keep NULL until reminded after this migration.

-- AlterTable: add the nullable completion reminder timestamps to orders.
ALTER TABLE "orders" ADD COLUMN "completion_reminder_1_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "completion_reminder_2_at" TIMESTAMP(3);
