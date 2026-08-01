-- Add new NotificationType enum values
ALTER TYPE "NotificationType" ADD VALUE 'POINTS_EARNED';
ALTER TYPE "NotificationType" ADD VALUE 'POINTS_REDEEMED';
ALTER TYPE "NotificationType" ADD VALUE 'CASHBACK_EARNED';
ALTER TYPE "NotificationType" ADD VALUE 'CASHBACK_REDEEMED';
ALTER TYPE "NotificationType" ADD VALUE 'TIER_UPGRADED';
ALTER TYPE "NotificationType" ADD VALUE 'TIER_DOWNGRADED';
ALTER TYPE "NotificationType" ADD VALUE 'BADGE_UNLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'REWARD_REDEEMED';
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_REWARD_CLAIMED';
ALTER TYPE "NotificationType" ADD VALUE 'VENDOR_REWARD_CAMPAIGN';
ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_OFFER';

-- Create RewardPoints table
CREATE TABLE "reward_points" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "reward_points_userId_unique" ON "reward_points"("userId");

-- Create CashbackBalance table
CREATE TABLE "cashback_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cashback_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "cashback_balances_userId_unique" ON "cashback_balances"("userId");

-- Create RewardTransaction table
CREATE TABLE "reward_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "reward_transactions_userId_idx" ON "reward_transactions"("userId");
CREATE INDEX "reward_transactions_createdAt_idx" ON "reward_transactions"("createdAt");
CREATE INDEX "reward_transactions_referenceId_idx" ON "reward_transactions"("referenceId");

-- Create CashbackTransaction table
CREATE TABLE "cashback_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cashback_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "cashback_transactions_userId_idx" ON "cashback_transactions"("userId");
CREATE INDEX "cashback_transactions_createdAt_idx" ON "cashback_transactions"("createdAt");
CREATE INDEX "cashback_transactions_referenceId_idx" ON "cashback_transactions"("referenceId");

-- Create LoyaltyTier table
CREATE TABLE "loyalty_tiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "color" TEXT NOT NULL,
    "minPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPoints" DOUBLE PRECISION,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "pointEarningRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cashbackRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "loyalty_tiers_displayOrder_idx" ON "loyalty_tiers"("displayOrder");

-- Create CustomerLoyalty table
CREATE TABLE "customer_loyalty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPointsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPointsRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCashbackEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCashbackRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeOrders" INTEGER NOT NULL DEFAULT 0,
    "lifetimeBookings" INTEGER NOT NULL DEFAULT 0,
    "lifetimeReviews" INTEGER NOT NULL DEFAULT 0,
    "lifetimeReferrals" INTEGER NOT NULL DEFAULT 0,
    "successfulReferrals" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "tierUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_loyalty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "customer_loyalty_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "loyalty_tiers"("id")
);

CREATE UNIQUE INDEX "customer_loyalty_userId_unique" ON "customer_loyalty"("userId");
CREATE INDEX "customer_loyalty_tierId_idx" ON "customer_loyalty"("tierId");
CREATE INDEX "customer_loyalty_points_idx" ON "customer_loyalty"("points");

-- Create Achievement table
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "badge" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "criteria" JSONB NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashbackReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "achievements_displayOrder_idx" ON "achievements"("displayOrder");

-- Create CustomerAchievement table
CREATE TABLE "customer_achievements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "customer_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "customer_achievements_userId_achievementId_unique" ON "customer_achievements"("userId", "achievementId");
CREATE INDEX "customer_achievements_userId_idx" ON "customer_achievements"("userId");
CREATE INDEX "customer_achievements_achievementId_idx" ON "customer_achievements"("achievementId");

-- Create ReferralRecord table
CREATE TABLE "referral_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT,
    "code" TEXT NOT NULL UNIQUE,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rewardPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewardCashback" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "referredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "referral_records_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "referral_records_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "referral_records_referrerId_idx" ON "referral_records"("referrerId");
CREATE INDEX "referral_records_refereeId_idx" ON "referral_records"("refereeId");
CREATE INDEX "referral_records_code_idx" ON "referral_records"("code");
CREATE INDEX "referral_records_status_idx" ON "referral_records"("status");

-- Create RewardRedemption table
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pointsUsed" DOUBLE PRECISION,
    "cashbackUsed" DOUBLE PRECISION,
    "couponId" TEXT,
    "orderId" TEXT,
    "serviceRequestId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reward_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "reward_redemptions_userId_idx" ON "reward_redemptions"("userId");
CREATE INDEX "reward_redemptions_createdAt_idx" ON "reward_redemptions"("createdAt");

-- Create VendorRewardCampaign table
CREATE TABLE "vendor_reward_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minPurchase" DOUBLE PRECISION,
    "maxReward" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "appliesToProducts" JSONB,
    "appliesToServices" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_reward_campaigns_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "vendor_reward_campaigns_vendorId_idx" ON "vendor_reward_campaigns"("vendorId");
CREATE INDEX "vendor_reward_campaigns_isActive_idx" ON "vendor_reward_campaigns"("isActive");

-- Create LoyaltyConfig table
CREATE TABLE "loyalty_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default loyalty tiers
INSERT INTO "loyalty_tiers" ("id", "name", "slug", "color", "minPoints", "maxPoints", "multiplier", "pointEarningRate", "cashbackRate", "description", "isActive", "displayOrder", "createdAt", "updatedAt") VALUES
('bronze-tier', 'Bronze', 'bronze', '#CD7F32', 0, 999, 1.0, 1.0, 0.0, 'Entry level loyalty tier', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('silver-tier', 'Silver', 'silver', '#C0C0C0', 1000, 4999, 1.2, 1.2, 0.02, 'Silver tier loyalty member', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('gold-tier', 'Gold', 'gold', '#FFD700', 5000, 14999, 1.5, 1.5, 0.05, 'Gold tier loyalty member', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('platinum-tier', 'Platinum', 'platinum', '#E5E4E2', 15000, 49999, 2.0, 2.0, 0.08, 'Platinum tier loyalty member', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('diamond-tier', 'Diamond', 'diamond', '#00D4FF', 50000, NULL, 3.0, 3.0, 0.12, 'Diamond tier loyalty member', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);