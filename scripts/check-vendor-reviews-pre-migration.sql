-- Pre-migration check for the vendor_reviews trust migration
-- (20261105150000_vendor_review_verified_purchase_and_order_unique).
--
-- Run this BEFORE applying the migration, e.g.:
--   PGPASSWORD=... psql "$DATABASE_URL" -f scripts/check-vendor-reviews-pre-migration.sql
--
-- The migration is designed to never delete review rows. It will fail when
-- creating the (orderId, storeId) unique index if duplicates exist, so
-- resolve any duplicates reported here first.

-- 1. Reviews that reference an orderId with no matching order (would break
--    the orderId -> orders foreign key).
SELECT 'orphaned-order-reference' AS check_name,
       vr.id AS review_id,
       vr.orderId,
       vr.storeId,
       vr.userId
FROM "vendor_reviews" vr
LEFT JOIN "orders" o ON o.id = vr.orderId
WHERE vr.orderId IS NOT NULL
  AND o.id IS NULL;

-- 2. Duplicate (orderId, storeId) pairs (would violate the new unique index
--    and block the migration).
SELECT 'duplicate-order-store-pair' AS check_name,
       vr.orderId,
       vr.storeId,
       count(*) AS review_count,
       array_agg(vr.id ORDER BY vr.createdAt) AS review_ids
FROM "vendor_reviews" vr
WHERE vr.orderId IS NOT NULL
GROUP BY vr.orderId, vr.storeId
HAVING count(*) > 1;

-- 3. Informational: legacy reviews without an orderId. These keep orderId
--    NULL and isVerifiedPurchase=false after the migration; they are not
--    deleted. Only rows matching an eligible paid + delivered/completed
--    order get orderId backfilled.
SELECT 'legacy-review-without-order' AS check_name,
       count(*) AS review_count
FROM "vendor_reviews"
WHERE orderId IS NULL;
