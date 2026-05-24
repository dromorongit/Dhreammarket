-- Separate VendorCategory and ProductCategory
-- This migration is now idempotent to handle databases that already have the correct structure

-- Rename the existing Category table to product_categories (only if categories exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') THEN
    ALTER TABLE "categories" RENAME TO "product_categories";
  END IF;
END $$;

-- Create the vendor_categories table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "vendor_categories" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Copy vendor categories from product_categories for those that are used by stores (only if store has categoryId column)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'store' AND column_name = 'categoryId') THEN
    INSERT INTO "vendor_categories" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
    SELECT "id", "name", "slug", "isActive", "createdAt", "updatedAt"
    FROM "product_categories"
    WHERE "id" IN (SELECT DISTINCT "categoryId" FROM "store" WHERE "categoryId" IS NOT NULL)
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Rename the categoryId column in the store table to vendorCategoryId (only if categoryId exists and vendorCategoryId doesn't)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'store' AND column_name = 'categoryId') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'store' AND column_name = 'vendorCategoryId') THEN
      ALTER TABLE "store" RENAME COLUMN "categoryId" TO "vendorCategoryId";
    END IF;
  END IF;
END $$;