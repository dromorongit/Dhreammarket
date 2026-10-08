-- Influencer perks: add columns, new table, and enum value

-- AlterTable: users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "influencerAttributionCode" VARCHAR(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "influencerBonusGrantedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "influencerCashbackOrdersUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: users
CREATE INDEX IF NOT EXISTS "idx_users_influencerAttributionCode" ON "users"("influencerAttributionCode");

-- AlterTable: vendor_subscriptions
ALTER TABLE "vendor_subscriptions" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);
ALTER TABLE "vendor_subscriptions" ADD COLUMN IF NOT EXISTS "source" VARCHAR(32);
ALTER TABLE "vendor_subscriptions" ADD COLUMN IF NOT EXISTS "influencerCode" VARCHAR(32);

-- CreateIndex: vendor_subscriptions
CREATE INDEX IF NOT EXISTS "idx_vendor_subscriptions_source" ON "vendor_subscriptions"("source");
CREATE INDEX IF NOT EXISTS "idx_vendor_subscriptions_influencer_code" ON "vendor_subscriptions"("influencerCode");

-- AlterTable: influencers
ALTER TABLE "influencers" ADD COLUMN IF NOT EXISTS "customerSignupPoints" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "influencers" ADD COLUMN IF NOT EXISTS "customerCashbackPercent" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "influencers" ADD COLUMN IF NOT EXISTS "customerCashbackMaxOrders" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "influencers" ADD COLUMN IF NOT EXISTS "vendorPlan" VARCHAR(32) NOT NULL DEFAULT 'STARTER';
ALTER TABLE "influencers" ADD COLUMN IF NOT EXISTS "vendorPlanDurationMonths" INTEGER NOT NULL DEFAULT 1;

-- CreateTable: influencer_cashbacks
CREATE TABLE IF NOT EXISTS "influencer_cashbacks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT,
    "order_id" TEXT NOT NULL,
    "cashback_amount" DOUBLE PRECISION NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'INFLUENCER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influencer_cashbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: influencer_cashbacks
CREATE UNIQUE INDEX IF NOT EXISTS "idx_influencer_cashbacks_order_id" ON "influencer_cashbacks"("order_id");
CREATE INDEX IF NOT EXISTS "idx_influencer_cashbacks_user_id" ON "influencer_cashbacks"("user_id");

-- AddForeignKey: influencer_cashbacks.user_id -> users.id
ALTER TABLE "influencer_cashbacks" ADD CONSTRAINT "influencer_cashbacks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum: CashbackSource
ALTER TYPE "CashbackSource" ADD VALUE IF NOT EXISTS 'INFLUENCER';
