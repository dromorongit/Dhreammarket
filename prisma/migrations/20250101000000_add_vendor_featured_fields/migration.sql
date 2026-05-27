-- AlterTable
-- This migration is now idempotent to handle databases that already have these columns
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "featuredUntil" TIMESTAMP(3);
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "banner" TEXT;

-- Set default for isFeatured if column was just created
ALTER TABLE "stores" ALTER COLUMN "isFeatured" SET DEFAULT false;
UPDATE "stores" SET "isFeatured" = false WHERE "isFeatured" IS NULL;