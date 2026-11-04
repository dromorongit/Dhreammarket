-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payToken" TEXT,
ADD COLUMN     "paymentLinkExpiresAt" TIMESTAMP(3),
ADD COLUMN     "paymentLinkRevokedAt" TIMESTAMP(3),
ADD COLUMN     "paymentRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reviewFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "reviewReason" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payment_attempts" (
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
CREATE UNIQUE INDEX "payment_attempts_reference_key" ON "payment_attempts"("reference");

-- CreateIndex
CREATE INDEX "payment_attempts_paymentId_idx" ON "payment_attempts"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_payToken_key" ON "orders"("payToken");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

