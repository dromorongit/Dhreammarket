-- Separate VendorCategory and ProductCategory
-- Rename the existing Category table to product_categories
ALTER TABLE "categories" RENAME TO "product_categories";

-- Create the vendor_categories table
CREATE TABLE "vendor_categories" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Copy vendor categories from product_categories for those that are used by stores
INSERT INTO "vendor_categories" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
SELECT "id", "name", "slug", "isActive", "createdAt", "updatedAt"
FROM "product_categories"
WHERE "id" IN (SELECT DISTINCT "categoryId" FROM "store" WHERE "categoryId" IS NOT NULL);

-- Rename the categoryId column in the store table to vendorCategoryId
ALTER TABLE "store" RENAME COLUMN "categoryId" TO "vendorCategoryId";