-- Remove storeId from order_items table
-- This column is no longer needed as storeId can be derived from the related product via:
-- SELECT p."storeId" FROM "products" p WHERE p."id" = "order_items"."productId"
-- 
-- This migration is idempotent and safe for existing data

ALTER TABLE "order_items" DROP COLUMN IF EXISTS "storeId";

-- Handle cart_items unique constraint for [cartId, productId, productVariantId]
-- First, remove duplicate entries keeping only the oldest one
-- This is needed in case users added the same product variant multiple times to cart

CREATE TEMP TABLE cart_items_unique ON COMMIT DROP AS
SELECT DISTINCT ON ("cartId", "productId", "productVariantId") *
FROM "cart_items"
ORDER BY "cartId", "productId", "productVariantId", "createdAt";

DELETE FROM "cart_items"
WHERE id NOT IN (SELECT id FROM cart_items_unique);

-- Add the unique constraint (will fail if other duplicates exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cart_items_cartId_productId_productVariantId_key'
  ) THEN
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_productId_productVariantId_key" UNIQUE ("cartId", "productId", "productVariantId");
  END IF;
END $$;