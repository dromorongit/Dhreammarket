-- Add nullable completedAt to orders.
--
-- Records the moment a vendor transitions an order from DELIVERED to COMPLETED.
-- No backfill: existing orders keep NULL until they are completed after this
-- migration runs. The application sets completedAt only when it is currently
-- NULL, so completing an order twice never overwrites the original timestamp.

-- AlterTable: add the nullable completion timestamp to orders.
ALTER TABLE "orders" ADD COLUMN "completedAt" TIMESTAMP(3);
