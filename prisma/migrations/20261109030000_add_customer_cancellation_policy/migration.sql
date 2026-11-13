-- Add customer cancellation policy tracking.
--
-- Additive migration: no existing tables or columns are modified, only new
-- objects are added so existing behaviour is unaffected until the policy is
-- enabled via the CANCELLATION_POLICY_ENABLED feature flag.

-- AlterTable: add the per-user cancellation block timestamp to users.
ALTER TABLE "users" ADD COLUMN "cancellationBlockedUntil" TIMESTAMP(3);

-- CreateTable: customer_cancellations records every paid non-manual customer
-- cancellation (including free ones) for the 30-day block count and the
-- platform revenue record (fee totals).
CREATE TABLE "customer_cancellations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_cancellations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_cancellations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "customer_cancellations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE
);

-- CreateIndex: unique cancellation per order.
CREATE UNIQUE INDEX "customer_cancellations_orderId_key" ON "customer_cancellations"("orderId");

-- CreateIndex: supports the 30-day cancellation count per user.
CREATE INDEX "customer_cancellations_userId_createdAt_idx" ON "customer_cancellations"("userId", "createdAt");
