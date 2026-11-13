-- Add daily summary fields to VendorSettings and the DAILY_SUMMARY notification type.
--
-- DAILY_SUMMARY is appended to the NotificationType enum and is intentionally not
-- referenced (no notifications of this type are created) in this migration.

-- AlterTable: add notifyDailySummary and lastDailySummaryDate to vendor_settings.
ALTER TABLE "vendor_settings" ADD COLUMN "notifyDailySummary" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "vendor_settings" ADD COLUMN "lastDailySummaryDate" TIMESTAMP(3);

-- AlterTable: append DAILY_SUMMARY to the NotificationType enum.
ALTER TYPE "NotificationType" ADD VALUE 'DAILY_SUMMARY';
