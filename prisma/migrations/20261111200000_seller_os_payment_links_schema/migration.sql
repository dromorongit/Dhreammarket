-- AlterTable (payment-link fields only; Payment.userId nullable and authorizationUrl handled by 20261104230000_make_payment_userid_nullable on main)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payToken" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentLinkExpiresAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentLinkRevokedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reviewFlaggedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reviewReason" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DOUBLE PRECISION NOT NULL,
    "authorizationUrl" TEXT,
    "accessCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_reference_key" ON "payment_attempts"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_attempts_paymentId_idx" ON "payment_attempts"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "orders_payToken_key" ON "orders"("payToken");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_attempts_paymentId_fkey'
  ) THEN
    ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;