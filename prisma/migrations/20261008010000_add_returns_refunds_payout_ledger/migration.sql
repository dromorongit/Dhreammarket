-- Returns, refunds and vendor payout ledger (phases 1-3)
-- Additive only: new enums, new tables, nullable/defaulted columns on order_items.
-- No row is inserted into platform_policy; the application upserts the singleton with defaults.

-- CreateEnum
CREATE TYPE "PayoutMode" AS ENUM ('REPORT_ONLY', 'AUTOMATIC', 'MANUAL');
CREATE TYPE "AdjustmentType" AS ENUM ('CHARGEBACK', 'FEE_CORRECTION', 'MANUAL');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'NEEDS_ATTENTION');
CREATE TYPE "ReturnReason" AS ENUM ('NOT_AS_DESCRIBED', 'DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'CHANGE_OF_MIND', 'OTHER');
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED', 'AWAITING_REFUND', 'ESCALATED', 'REJECTED', 'CLOSED');
CREATE TYPE "DeliveryConfirmedBy" AS ENUM ('VENDOR', 'CUSTOMER', 'AUTO', 'ADMIN');

-- AlterTable: order_items (all new columns nullable; no existing column is touched)
ALTER TABLE "order_items" ADD COLUMN "shippedAt" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN "deliveryConfirmedAt" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN "deliveryConfirmedBy" "DeliveryConfirmedBy";

-- CreateTable: platform_policy (single row, fixed id 'singleton')
CREATE TABLE "platform_policy" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "systemCutoverTimestamp" TIMESTAMP(3),
    "returnWindowDays" INTEGER NOT NULL DEFAULT 3,
    "vendorResponseBusinessDays" INTEGER NOT NULL DEFAULT 3,
    "disputeResolutionBusinessDays" INTEGER NOT NULL DEFAULT 7,
    "autoConfirmDeliveryDays" INTEGER NOT NULL DEFAULT 3,
    "payoutHoldDaysAfterConfirmation" INTEGER NOT NULL DEFAULT 2,
    "dispatchTargetDaysAfterPayment" INTEGER NOT NULL DEFAULT 3,
    "minOrdersBeforeShowingRate" INTEGER NOT NULL DEFAULT 10,
    "payoutMode" "PayoutMode" NOT NULL DEFAULT 'REPORT_ONLY',
    "holidayList" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "refundProcessingWindowDays" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable: refunds
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "walletAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "paystackRefundId" TEXT,
    "paystackStatus" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable: return_requests
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "reason" "ReturnReason" NOT NULL,
    "returnRequired" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "policySnapshot" JSONB NOT NULL,
    "escalationDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: return_request_events
CREATE TABLE "return_request_events" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: return_request_attachments
CREATE TABLE "return_request_attachments" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_payout_items (unique on orderItemId only)
CREATE TABLE "vendor_payout_items" (
    "id" TEXT NOT NULL,
    "vendorPayoutId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payout_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_balance_adjustments
CREATE TABLE "vendor_balance_adjustments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "appliedPayoutId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "adjustmentType" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraints expressed as unique indexes (additive statement type)
CREATE UNIQUE INDEX "refunds_idempotencyKey_key" ON "refunds"("idempotencyKey");
CREATE UNIQUE INDEX "vendor_payout_items_orderItemId_key" ON "vendor_payout_items"("orderItemId");

-- CreateIndex: lookup indexes
CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");
CREATE INDEX "refunds_orderItemId_idx" ON "refunds"("orderItemId");
CREATE INDEX "refunds_status_idx" ON "refunds"("status");
CREATE INDEX "refunds_paystackRefundId_idx" ON "refunds"("paystackRefundId");
CREATE INDEX "return_requests_orderItemId_idx" ON "return_requests"("orderItemId");
CREATE INDEX "return_requests_customerId_idx" ON "return_requests"("customerId");
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");
CREATE INDEX "return_request_events_returnRequestId_idx" ON "return_request_events"("returnRequestId");
CREATE INDEX "return_request_attachments_returnRequestId_idx" ON "return_request_attachments"("returnRequestId");
CREATE INDEX "vendor_payout_items_vendorPayoutId_idx" ON "vendor_payout_items"("vendorPayoutId");
CREATE INDEX "vendor_balance_adjustments_vendorId_idx" ON "vendor_balance_adjustments"("vendorId");
CREATE INDEX "vendor_balance_adjustments_storeId_idx" ON "vendor_balance_adjustments"("storeId");
CREATE INDEX "vendor_balance_adjustments_appliedPayoutId_idx" ON "vendor_balance_adjustments"("appliedPayoutId");
CREATE INDEX "vendor_balance_adjustments_orderItemId_idx" ON "vendor_balance_adjustments"("orderItemId");
CREATE INDEX "vendor_balance_adjustments_refundId_idx" ON "vendor_balance_adjustments"("refundId");

-- CreateIndex: partial unique index - at most one OPEN return case per order item.
-- Open statuses: PENDING, ITEM_IN_TRANSIT, ITEM_RECEIVED, AWAITING_REFUND, ESCALATED.
-- NOTE: a REJECTED case is only open while its escalation window is still running
-- (escalationDeadline > now()). PostgreSQL requires partial-index predicates to be
-- IMMUTABLE and now() is STABLE, so the REJECTED-escalation-window condition is
-- enforced in application code (guard before creating a new case), not in this index.
CREATE UNIQUE INDEX "return_requests_one_open_per_item_idx" ON "return_requests"("orderItemId")
    WHERE status IN ('PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED', 'AWAITING_REFUND', 'ESCALATED');

-- AddForeignKey: refunds
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: return_requests
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: return_request_events / return_request_attachments
ALTER TABLE "return_request_events" ADD CONSTRAINT "return_request_events_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_attachments" ADD CONSTRAINT "return_request_attachments_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: vendor_payout_items
ALTER TABLE "vendor_payout_items" ADD CONSTRAINT "vendor_payout_items_vendorPayoutId_fkey" FOREIGN KEY ("vendorPayoutId") REFERENCES "vendor_payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_payout_items" ADD CONSTRAINT "vendor_payout_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: vendor_balance_adjustments
ALTER TABLE "vendor_balance_adjustments" ADD CONSTRAINT "vendor_balance_adjustments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_balance_adjustments" ADD CONSTRAINT "vendor_balance_adjustments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_balance_adjustments" ADD CONSTRAINT "vendor_balance_adjustments_appliedPayoutId_fkey" FOREIGN KEY ("appliedPayoutId") REFERENCES "vendor_payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_balance_adjustments" ADD CONSTRAINT "vendor_balance_adjustments_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_balance_adjustments" ADD CONSTRAINT "vendor_balance_adjustments_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
