-- 20261009000000_add_refund_links
-- Additive only: link refunds to orders, return requests and initiating users.
-- All new columns nullable except currency (NOT NULL DEFAULT 'GHS').
-- FKs use ON DELETE RESTRICT ON UPDATE CASCADE. No destructive statements.

ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "returnRequestId" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "initiatedByUserId" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "initiatedByRole" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GHS';

CREATE INDEX IF NOT EXISTS "refunds_orderId_idx" ON "refunds" ("orderId");
CREATE INDEX IF NOT EXISTS "refunds_returnRequestId_idx" ON "refunds" ("returnRequestId");
CREATE INDEX IF NOT EXISTS "refunds_initiatedByUserId_idx" ON "refunds" ("initiatedByUserId");

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
