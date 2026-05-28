-- Add averageRating and reviewCount fields to stores and products tables
-- This migration is idempotent to handle databases that already have these columns

-- Add columns to stores table
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "averageRating" DOUBLE PRECISION;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER;

-- Set defaults for stores if columns were just created
ALTER TABLE "stores" ALTER COLUMN "averageRating" SET DEFAULT 0;
UPDATE "stores" SET "averageRating" = 0 WHERE "averageRating" IS NULL;
ALTER TABLE "stores" ALTER COLUMN "reviewCount" SET DEFAULT 0;
UPDATE "stores" SET "reviewCount" = 0 WHERE "reviewCount" IS NULL;

-- Add columns to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "averageRating" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER;

-- Set defaults for products if columns were just created
ALTER TABLE "products" ALTER COLUMN "averageRating" SET DEFAULT 0;
UPDATE "products" SET "averageRating" = 0 WHERE "averageRating" IS NULL;
ALTER TABLE "products" ALTER COLUMN "reviewCount" SET DEFAULT 0;
UPDATE "products" SET "reviewCount" = 0 WHERE "reviewCount" IS NULL;