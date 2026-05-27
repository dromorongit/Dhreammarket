-- Add financial fields to Order and OrderItem models

-- Add columns to orders table
ALTER TABLE "orders" ADD COLUMN "grossAmount" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "processorFee" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "netAmount" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "platformCommission" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "vendorEarnings" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "commissionRate" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "subtotal" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "shipping" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "tax" DOUBLE PRECISION;

-- Add columns to order_items table
ALTER TABLE "order_items" ADD COLUMN "grossAmount" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN "processorFee" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN "netAmount" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN "platformCommission" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN "vendorEarnings" DOUBLE PRECISION;
ALTER TABLE "order_items" ADD COLUMN "commissionRate" DOUBLE PRECISION;