-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM ('MOBILE_MONEY', 'BANK_ACCOUNT');

-- CreateTable
CREATE TABLE "vendor_payout_methods" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "PayoutMethodType" NOT NULL DEFAULT 'MOBILE_MONEY',
    "details" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_payout_methods_vendorId_idx" ON "vendor_payout_methods"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_payout_methods_storeId_idx" ON "vendor_payout_methods"("storeId");

-- AddForeignKey
ALTER TABLE "vendor_payout_methods" ADD CONSTRAINT "vendor_payout_methods_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payout_methods" ADD CONSTRAINT "vendor_payout_methods_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON UPDATE CASCADE;
