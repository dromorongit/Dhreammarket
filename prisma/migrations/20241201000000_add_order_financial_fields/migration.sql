-- Add financial fields to Order and OrderItem models
-- This migration is now idempotent to handle databases that already have these columns

-- Add columns to orders table (IF NOT EXISTS to prevent errors if already applied)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "processorFee" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "netAmount" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "platformCommission" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "vendorEarnings" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax" DOUBLE PRECISION;

-- Add columns to order_items table (IF NOT EXISTS to prevent errors if already applied)
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "processorFee" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "netAmount" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "platformCommission" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "vendorEarnings" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION;