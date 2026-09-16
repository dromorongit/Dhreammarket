-- CreateEnum: none required (no new enums)

-- CreateTable: marketing_officers
CREATE TABLE "marketing_officers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "referralCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_officers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_referrals
CREATE TABLE "vendor_referrals" (
    "id" TEXT NOT NULL,
    "vendorUserId" TEXT NOT NULL,
    "marketingOfficerId" TEXT NOT NULL,
    "codeUsed" TEXT NOT NULL,
    "amountOwed" DOUBLE PRECISION NOT NULL DEFAULT 25.00,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: marketing_officers.referralCode (unique)
CREATE UNIQUE INDEX "marketing_officers_referralCode_key" ON "marketing_officers"("referralCode");
CREATE INDEX "marketing_officers_referralCode_idx" ON "marketing_officers"("referralCode");
CREATE INDEX "marketing_officers_active_idx" ON "marketing_officers"("active");

-- CreateIndex: vendor_referrals.vendorUserId (unique, one attribution per vendor)
CREATE UNIQUE INDEX "vendor_referrals_vendorUserId_key" ON "vendor_referrals"("vendorUserId");
CREATE INDEX "vendor_referrals_marketingOfficerId_idx" ON "vendor_referrals"("marketingOfficerId");
CREATE INDEX "vendor_referrals_paid_idx" ON "vendor_referrals"("paid");
CREATE INDEX "vendor_referrals_createdAt_idx" ON "vendor_referrals"("createdAt");

-- AddForeignKey: vendor_referrals.vendorUserId -> users.id
ALTER TABLE "vendor_referrals" ADD CONSTRAINT "vendor_referrals_vendorUserId_fkey"
    FOREIGN KEY ("vendorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: vendor_referrals.marketingOfficerId -> marketing_officers.id
ALTER TABLE "vendor_referrals" ADD CONSTRAINT "vendor_referrals_marketingOfficerId_fkey"
    FOREIGN KEY ("marketingOfficerId") REFERENCES "marketing_officers"("id") ON DELETE CASCADE ON UPDATE CASCADE;