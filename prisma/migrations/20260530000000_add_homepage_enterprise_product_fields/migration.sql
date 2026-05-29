-- Homepage enterprise product fields and section types
-- Idempotent for production databases that may already have some columns

-- Product promo / analytics columns
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSalePrice" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSaleStart" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSaleEnd" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salesCount" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isSponsored" BOOLEAN;

ALTER TABLE "products" ALTER COLUMN "salesCount" SET DEFAULT 0;
UPDATE "products" SET "salesCount" = 0 WHERE "salesCount" IS NULL;

ALTER TABLE "products" ALTER COLUMN "isSponsored" SET DEFAULT false;
UPDATE "products" SET "isSponsored" = false WHERE "isSponsored" IS NULL;

ALTER TABLE "products" ALTER COLUMN "salesCount" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "isSponsored" SET NOT NULL;

-- HomepageSectionType enum values for enterprise sections
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'HomepageSectionType' AND e.enumlabel = 'FLASH_SALES'
    ) THEN
        ALTER TYPE "HomepageSectionType" ADD VALUE 'FLASH_SALES';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'HomepageSectionType' AND e.enumlabel = 'SPONSORED_PRODUCTS'
    ) THEN
        ALTER TYPE "HomepageSectionType" ADD VALUE 'SPONSORED_PRODUCTS';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'HomepageSectionType' AND e.enumlabel = 'TOP_SELLING'
    ) THEN
        ALTER TYPE "HomepageSectionType" ADD VALUE 'TOP_SELLING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'HomepageSectionType' AND e.enumlabel = 'BIG_DEALS'
    ) THEN
        ALTER TYPE "HomepageSectionType" ADD VALUE 'BIG_DEALS';
    END IF;
END $$;
