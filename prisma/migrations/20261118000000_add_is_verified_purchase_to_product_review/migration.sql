-- Add isVerifiedPurchase column to product_reviews
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: set isVerifiedPurchase = true where orderId is set and the order was paid and delivered
UPDATE "product_reviews" pr
SET "isVerifiedPurchase" = TRUE
FROM "orders" o
WHERE pr."orderId" = o."id"
  AND o."paymentStatus" = 'PAID'
  AND o."status" IN ('DELIVERED', 'COMPLETED')
  AND pr."isVerifiedPurchase" = FALSE;