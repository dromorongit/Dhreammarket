# Customer Loyalty & Rewards System - Architecture Documentation

## Overview

The Customer Loyalty & Rewards System is an enterprise-grade loyalty ecosystem built into the Dhream Market platform. It rewards customer engagement, purchases, service bookings, referrals, and platform activity while integrating seamlessly with the AI Marketplace Intelligence and Enterprise Analytics modules.

## Architecture

### Database Models

The system uses the following Prisma models (added to `prisma/schema.prisma`):

#### Core Models
- **RewardPoints** - Tracks customer reward points balance and totals
- **CashbackBalance** - Tracks customer cashback balance and totals
- **RewardTransaction** - Immutable transaction log for all points operations
- **CashbackTransaction** - Immutable transaction log for all cashback operations
- **LoyaltyTier** - Configurable tier levels (Bronze, Silver, Gold, Platinum, Diamond)
- **CustomerLoyalty** - Links customers to their current tier and tracks lifetime stats
- **Achievement** - Defines achievement badges and their criteria
- **CustomerAchievement** - Tracks which achievements each customer has unlocked
- **ReferralRecord** - Tracks referral codes, status, and rewards
- **RewardRedemption** - Records all reward/cashback redemptions
- **VendorRewardCampaign** - Vendor-funded reward campaigns
- **LoyaltyConfig** - Key-value store for super admin configuration

#### Enums Added
- `TransactionType` - EARN, REDEEM, ADJUST, EXPIRE, BONUS
- `RewardCategory` - PURCHASE, SERVICE_BOOKING, REVIEW, REVIEW_IMAGE, REVIEW_VIDEO, DAILY_LOGIN, PROFILE_COMPLETE, FOLLOW_VENDOR, REFERRAL, SUCCESSFUL_REFERRAL, WISHLIST_ACTIVITY, COLLECTION_CREATE, REPEAT_PURCHASE, REPEAT_BOOKING, COUPON_REDEEM, CASHBACK_REDEEM, SPECIAL_OFFER
- `CashbackSource` - PRODUCT_PURCHASE, SERVICE_BOOKING, VENDOR_CAMPAIGN, PROMOTIONAL_CAMPAIGN, REFERRAL_BONUS, REWARD_REDEMPTION, ADJUSTMENT
- `ReferralStatus` - PENDING, COMPLETED, REWARD_CLAIMED, EXPIRED, CANCELLED
- `RedemptionType` - POINTS, CASHBACK, COUPON, MIXED
- `RedemptionStatus` - PENDING, COMPLETED, FAILED, CANCELLED
- `CampaignType` - POINTS_MULTIPLIER, CASHBACK_BONUS, DISCOUNT, FIXED_REWARD, BUNDLE_OFFER
- `RewardType` - POINTS, CASHBACK, COUPON, DISCOUNT

#### Notification Types Added
- POINTS_EARNED, POINTS_REDEEMED, CASHBACK_EARNED, CASHBACK_REDEEMED
- TIER_UPGRADED, TIER_DOWNGRADED, BADGE_UNLOCKED
- REWARD_REDEEMED, REFERRAL_COMPLETED, REFERRAL_REWARD_CLAIMED
- VENDOR_REWARD_CAMPAIGN, LOYALTY_OFFER

### Engine Modules

All engine modules are located in `lib/loyalty/`:

#### reward-engine.ts
- `earnPoints()` - Awards points to a customer
- `redeemPoints()` - Redeems points from a customer
- `getPointsBalance()` - Gets current points balance
- `getPointsHistory()` - Paginated transaction history
- `adjustPoints()` - Admin adjustment of points

#### cashback-engine.ts
- `earnCashback()` - Awards cashback to a customer
- `redeemCashback()` - Redeems cashback from a customer
- `getCashbackBalance()` - Gets current cashback balance
- `getCashbackHistory()` - Paginated transaction history
- `getCashbackForOrder()` - Calculates cashback for an order based on tier and campaigns

#### referral-engine.ts
- `createReferral()` - Creates a new referral record with unique code
- `completeReferral()` - Marks a referral as completed when referee signs up
- `claimReferralReward()` - Awards referral rewards to the referrer
- `getReferralStats()` - Gets referral statistics for a customer
- `getReferralLeaderboard()` - Gets top referrers

#### achievement-engine.ts
- `checkAchievement()` - Checks if a customer qualifies for an achievement
- `unlockAchievement()` - Unlocks an achievement for a customer
- `getUserAchievements()` - Gets all achievements with progress for a customer

#### tier-engine.ts
- `getCurrentTier()` - Gets the current loyalty tier for a customer
- `updateTier()` - Automatically upgrades/downgrades a customer based on points
- `addPoints()` - Adds points and triggers tier update
- `getLoyaltyTiers()` - Gets all active loyalty tiers
- `getLoyaltyConfig()` / `updateLoyaltyConfig()` - Key-value config management

#### loyalty-engine.ts
Orchestrator module that combines all sub-engines and provides high-level processing functions:
- `processPurchaseReward()` - Processes points and cashback for product purchases
- `processServiceBookingReward()` - Processes rewards for service bookings
- `processReviewReward()` - Processes rewards for writing reviews
- `processDailyLoginReward()` - Processes daily login rewards
- `processProfileCompleteReward()` - Processes profile completion rewards
- `processFollowVendorReward()` - Processes vendor follow rewards
- `processWishlistActivityReward()` - Processes wishlist activity rewards
- `processCollectionCreateReward()` - Processes collection creation rewards
- `processRepeatPurchaseReward()` - Processes repeat purchase bonuses
- `processRepeatBookingReward()` - Processes repeat booking bonuses

### API Routes

All API routes are under `/app/api/loyalty/`:

#### Customer-Facing
- `GET /api/loyalty` - Get full loyalty dashboard data
- `POST /api/loyalty/earn/purchase` - Process purchase reward
- `POST /api/loyalty/earn/booking` - Process service booking reward
- `POST /api/loyalty/earn/review` - Process review reward
- `POST /api/loyalty/earn/login` - Process daily login reward
- `POST /api/loyalty/earn/profile` - Process profile completion reward
- `POST /api/loyalty/earn/follow` - Process vendor follow reward
- `POST /api/loyalty/earn/wishlist` - Process wishlist activity reward
- `POST /api/loyalty/earn/collection` - Process collection creation reward
- `POST /api/loyalty/redeem/points` - Redeem points
- `POST /api/loyalty/redeem/cashback` - Redeem cashback
- `GET /api/loyalty/referral` - Get referral stats and leaderboard
- `POST /api/loyalty/referral/complete` - Complete a referral
- `GET /api/loyalty/achievements` - Get user achievements
- `GET /api/loyalty/tier` - Get current tier
- `GET /api/loyalty/tier/list` - Get all loyalty tiers

#### Super Admin
- `GET /api/loyalty/admin/config` - Get loyalty configuration
- `PUT /api/loyalty/admin/config` - Update loyalty configuration
- `GET /api/loyalty/admin/tiers` - Get all loyalty tiers
- `POST /api/loyalty/admin/tiers` - Create new loyalty tier
- `GET /api/loyalty/admin/achievements` - Get all achievements
- `POST /api/loyalty/admin/achievements` - Create new achievement
- `GET /api/loyalty/admin/campaigns` - Get vendor reward campaigns
- `POST /api/loyalty/admin/campaigns` - Create vendor reward campaign
- `GET /api/loyalty/admin/analytics` - Get loyalty analytics
- `GET /api/loyalty/admin/customers` - Get loyalty customer list

### UI Components

Located in `components/loyalty/`:
- `LoyaltyTierCard` - Displays current tier with progress bar
- `PointsCard` - Displays points balance and totals
- `CashbackCard` - Displays cashback balance and totals
- `AchievementBadge` - Displays individual achievement with unlock status
- `ReferralStatsCard` - Displays referral statistics and code

### Dashboard Pages

- `/dashboard/customer/loyalty` - Customer loyalty dashboard with tabs for Overview, Achievements, Referrals, and History
- `/dashboard/super-admin/loyalty` - Super admin configuration page with tabs for Configuration, Tiers, Achievements, Campaigns, and Analytics

### Integration Points

#### AI Integration (`lib/loyalty/ai-integration.ts`)
- `getPersonalizedRewardOffers()` - Generates personalized reward offers based on customer behavior
- `getAIRewardSuggestions()` - Generates AI-powered reward suggestions

#### Notification Integration (`lib/loyalty/notification-integration.ts`)
- Functions to send notifications for all loyalty events (points earned, cashback earned, tier upgrades, badge unlocks, etc.)

#### Vendor Integration (`lib/loyalty/vendor-integration.ts`)
- `getVendorRewardCampaigns()` - Gets active vendor campaigns
- `processVendorCampaignReward()` - Processes rewards from vendor campaigns
- `getVendorLoyaltyCampaigns()` - Gets vendor loyalty campaigns
- `getVendorExclusiveCoupons()` - Gets vendor-exclusive coupons

## Configuration

The system is fully configurable from the Super Admin dashboard:
- Point values for each activity type
- Cashback percentages
- Loyalty tier thresholds and multipliers
- Achievement badge criteria
- Referral reward amounts
- Enable/disable reward types
- Vendor campaign management

## Key Design Principles

1. **No breaking changes** - The system does not modify checkout, AI recommendations, analytics, homepage, homepage builder, or homepage merchandising engine
2. **Automatic processing** - Rewards are processed automatically when marketplace activities occur
3. **Configurable** - All point values, cashback rates, and tier thresholds are configurable from the Super Admin dashboard
4. **Enterprise-grade** - Uses transactions for data consistency, proper error handling, and pagination
5. **No duplicate calculations** - Each reward is recorded as an immutable transaction
6. **Fully responsive** - All UI components use Tailwind CSS responsive design