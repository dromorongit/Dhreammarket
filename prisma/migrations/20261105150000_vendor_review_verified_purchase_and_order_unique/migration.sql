-- Vendor review trust migration (safe: never deletes review rows).
--
-- 1. Adds the stored isVerifiedPurchase flag.
-- 2. Backfills orderId for legacy reviews that lack one by attaching the
--    earliest eligible paid + delivered/completed order for the same
--    reviewer and store. Reviews with no eligible order keep orderId NULL
--    and isVerifiedPurchase=false -- they are NOT deleted.
-- 3. Replaces the (userId, storeId) uniqueness with (orderId, storeId).
--    NULL orderId values are distinct in PostgreSQL, so legacy reviews
--    without an order can coexist.
-- 4. orderId becomes optional and the order FK uses ON DELETE SET NULL so
--    deleting an order never cascades into deleting a review.

-- Add stored isVerifiedPurchase flag to vendor_reviews.
ALTER TABLE "vendor_reviews" ADD COLUMN "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- Backfill orderId for existing reviews that lack one. Rows that cannot be
-- matched keep orderId NULL (no DELETE).
UPDATE "vendor_reviews" vr
SET "orderId" = sub.id
FROM (
  SELECT DISTINCT ON (vr2.id) vr2.id AS review_id, o.id AS id
  FROM "vendor_reviews" vr2
  JOIN "orders" o ON o."userId" = vr2."userId"
  JOIN "order_items" oi ON oi."orderId" = o.id
  JOIN "products" p ON p.id = oi."productId" AND p."storeId" = vr2."storeId"
  WHERE vr2."orderId" IS NULL
    AND o."paymentStatus" = 'PAID'
    AND o."status" IN ('DELIVERED', 'COMPLETED')
  ORDER BY vr2.id, o."createdAt" ASC
) sub
WHERE vr.id = sub.review_id;

-- Backfill isVerifiedPurchase for rows whose order is paid + delivered/completed.
UPDATE "vendor_reviews" vr
SET "isVerifiedPurchase" = true
WHERE vr."orderId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o.id = vr."orderId"
      AND o."paymentStatus" = 'PAID'
      AND o."status" IN ('DELIVERED', 'COMPLETED')
  );

-- Replace the old (userId, storeId) uniqueness with (orderId, storeId).
DROP INDEX IF EXISTS "vendor_reviews_userId_storeId_key";
CREATE UNIQUE INDEX "vendor_reviews_orderId_storeId_key" ON "vendor_reviews"("orderId", "storeId");

-- orderId is now optional: legacy reviews keep NULL when no order matches.
-- Deleting an order sets orderId to NULL instead of deleting the review.
ALTER TABLE "vendor_reviews" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "vendor_reviews" DROP CONSTRAINT IF EXISTS "vendor_reviews_orderId_fkey";
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL;
