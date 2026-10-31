CREATE INDEX IF NOT EXISTS "orders_source_paymentStatus_createdAt_idx" ON "orders" ("source", "paymentStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "order_items_productId_deliveredAt_idx" ON "order_items" ("productId", "deliveredAt");
CREATE INDEX IF NOT EXISTS "product_reviews_productId_isApproved_isHidden_idx" ON "product_reviews" ("productId", "isApproved", "isHidden");
CREATE INDEX IF NOT EXISTS "vendor_reviews_storeId_isApproved_isHidden_idx" ON "vendor_reviews" ("storeId", "isApproved", "isHidden");
CREATE INDEX IF NOT EXISTS "return_requests_status_createdAt_idx" ON "return_requests" ("status", "createdAt");
