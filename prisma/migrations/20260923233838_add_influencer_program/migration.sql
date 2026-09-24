-- Influencer Program: new tables only. No existing table is touched.

-- CreateTable: influencers
CREATE TABLE IF NOT EXISTS "influencers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "referralCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "incentivePerVendor" DOUBLE PRECISION,
    "incentivePerCustomer" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: influencer_referrals
CREATE TABLE IF NOT EXISTS "influencer_referrals" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "refereeRole" TEXT NOT NULL,
    "codeUsed" TEXT NOT NULL,
    "registrationIpAddress" TEXT,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "qualifiedAt" TIMESTAMP(3),
    "incentiveAmount" DOUBLE PRECISION,
    "incentivePaid" BOOLEAN NOT NULL DEFAULT false,
    "incentivePaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influencer_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: influencer_clicks
CREATE TABLE IF NOT EXISTS "influencer_clicks" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrerUrl" TEXT,
    "landingPage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influencer_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: influencers
CREATE UNIQUE INDEX IF NOT EXISTS "influencers_referralCode_key" ON "influencers"("referralCode");
CREATE INDEX IF NOT EXISTS "influencers_referralCode_idx" ON "influencers"("referralCode");
CREATE INDEX IF NOT EXISTS "influencers_active_idx" ON "influencers"("active");

-- CreateIndex: influencer_referrals
CREATE UNIQUE INDEX IF NOT EXISTS "influencer_referrals_refereeId_key" ON "influencer_referrals"("refereeId");
CREATE INDEX IF NOT EXISTS "influencer_referrals_influencerId_idx" ON "influencer_referrals"("influencerId");
CREATE INDEX IF NOT EXISTS "influencer_referrals_refereeRole_idx" ON "influencer_referrals"("refereeRole");
CREATE INDEX IF NOT EXISTS "influencer_referrals_qualified_idx" ON "influencer_referrals"("qualified");
CREATE INDEX IF NOT EXISTS "influencer_referrals_incentivePaid_idx" ON "influencer_referrals"("incentivePaid");
CREATE INDEX IF NOT EXISTS "influencer_referrals_createdAt_idx" ON "influencer_referrals"("createdAt");

-- CreateIndex: influencer_clicks
CREATE INDEX IF NOT EXISTS "influencer_clicks_influencerId_idx" ON "influencer_clicks"("influencerId");
CREATE INDEX IF NOT EXISTS "influencer_clicks_ipAddress_idx" ON "influencer_clicks"("ipAddress");
CREATE INDEX IF NOT EXISTS "influencer_clicks_createdAt_idx" ON "influencer_clicks"("createdAt");

-- AddForeignKey: influencer_referrals.refereeId -> users.id
ALTER TABLE "influencer_referrals" ADD CONSTRAINT "influencer_referrals_refereeId_fkey"
    FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: influencer_referrals.influencerId -> influencers.id
ALTER TABLE "influencer_referrals" ADD CONSTRAINT "influencer_referrals_influencerId_fkey"
    FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: influencer_clicks.influencerId -> influencers.id
ALTER TABLE "influencer_clicks" ADD CONSTRAINT "influencer_clicks_influencerId_fkey"
    FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
