-- Complete SQL to fix missing database columns
-- Run this in Railway's PostgreSQL console

-- Products table columns
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSalePrice" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSaleStart" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSaleEnd" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isSponsored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "dealsPrice" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salesPrice" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "availabilityType" "ProductAvailabilityType" NOT NULL DEFAULT 'IN_STOCK';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "expectedArrivalDate" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "estimatedFulfillmentDays" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "preOrderNotes" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "expectedRestockDate" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "backOrderNotes" TEXT;

-- Product variants table columns
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Orders table columns
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventoryConsumedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "allocatedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderType" "OrderType" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'PENDING';

-- Order items table columns
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "allocatedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "availabilityType" "ProductAvailabilityType";
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "expectedArrivalDate" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "expectedRestockDate" TIMESTAMP(3);

-- Create enum types if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductAvailabilityType') THEN
        CREATE TYPE "ProductAvailabilityType" AS ENUM ('IN_STOCK', 'PREORDER', 'BACKORDER');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderFulfillmentStatus') THEN
        CREATE TYPE "OrderFulfillmentStatus" AS ENUM ('PENDING', 'AWAITING_STOCK', 'AWAITING_RESTOCK', 'READY_TO_FULFILL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderType') THEN
        CREATE TYPE "OrderType" AS ENUM ('NORMAL', 'PREORDER', 'BACKORDER');
    END IF;
END $$;