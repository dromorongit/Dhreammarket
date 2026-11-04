# Dhream Market — Stage 2 Architecture and Data

**Source of truth:** repository at `C:\Users\Dromor Narh\Desktop\GithubRepos\Dhream Market`. Read-only audit; no source files modified.

## Request flow from UI to database

1. **Browser → Next.js App Router.** Pages live under `app/` (App Router). The root layout `app/layout.tsx:46` loads session via `getServerSession()` (`lib/auth.ts:56`), renders Navbar/Footer/CartProvider/QueryProvider/SupportChatWidget/WaitlistPromo.
2. **Middleware (`middleware.ts`).** Runs on `/dashboard/:path*`, `/api/:path*`, `/receipt/:path*`. For `/api/*`, it copies a Bearer `Authorization` header into the `token` cookie so downstream route handlers read it from cookies. For dashboard routes, it verifies the JWT edge-side via `verifyTokenEdge` (`lib/auth-edge.ts:12`) and enforces role ACL (`middleware.ts:8-14`):
   - `/dashboard/admin` → ADMIN, SUPER_ADMIN
   - `/dashboard/super-admin` → SUPER_ADMIN
   - `/dashboard/influencer` → INFLUENCER, SUPER_ADMIN
   - `/dashboard/vendor` → VENDOR, ADMIN, SUPER_ADMIN
   - `/dashboard/customer` → CUSTOMER, VENDOR, ADMIN, SUPER_ADMIN
3. **API route → auth check.** Each route handler reads the `token` cookie and calls `verifyToken` (`lib/auth-middleware.ts:22`) which verifies the JWT with `jose` AND validates the `Session` row is present, not expired, and the user is ACTIVE. On failure returns 401 and clears the cookie.
4. **API route → Prisma → PostgreSQL.** Server actions/route handlers call `getPrisma()` (`lib/prisma.ts:14`), a singleton PrismaClient backed by a `pg` pool (max 10) via `@prisma/adapter-pg` when DATABASE_URL is postgres; falls back to file-based `dev.db` otherwise. Queries hit PostgreSQL.
5. **Payments call Paystack server-to-server.** Checkout initializes via `initializePaystackPayment` (`lib/paystack.ts:104`) POST to `https://api.paystack.co/transaction/initialize`; client returns to Paystack authorization URL; payment verified either client-side (`POST /api/payment/verify`) or via Paystack webhook (`POST /api/webhook/paystack` → `lib/webhooks/order-webhook-handler.ts`).
6. **Stock reservation.** On successful payment, `reserveStock` (`lib/stock-reservation.ts:25`) runs `SELECT ... FOR UPDATE` on `products`/`product_variants` and increments `reservedQuantity`. `consumeInventory` (`lib/stock-reservation.ts:369`) decrements `stock` and `reservedQuantity` and sets `order.inventoryConsumedAt`.
7. **Build/start.** `npm run build` → `next build` (standalone output). `npm run start` → `prisma migrate deploy` then `node server-entry.js` (`server-entry.js`) which loads `.next/standalone/server.js`.

## Data models and relationships (key entities)

Defined in `prisma/schema.prisma` (3282 lines), mapped to PostgreSQL tables via `@@map`. Primary keys are `cuid()` or `dbgenerated("gen_random_uuid())`. Currency default is GHS.

**Core commerce**
- `User` (`users`) — id (cuid), email (unique), password (bcrypt hash), role (Role enum), status (UserStatus), referralCode, isEmailVerified, resetPasswordToken/Expires. Roles: SUPER_ADMIN, ADMIN, INFLUENCER, VENDOR, CUSTOMER.
- `Profile` (`profiles`) — 1:1 with User; firstName, lastName, phone, avatar, currency (default GHS), timezone (default Africa/Accra).
- `Store` (`stores`) — 1:1 with User (userId unique); name, slug (unique), isVerified, isFeatured, averageRating, reviewCount, whatsappNumber, canSellProducts/canOfferServices, setupComplete.
- `Product` (`products`) — belongs to Store + ProductCategory; name, price, stock, reservedQuantity, lowStockThreshold, slug (unique), availabilityType (IN_STOCK/PREORDER/BACKORDER), flashSalePrice, dealsPrice, salesPrice, isReturnable, costPrice. Variants via `ProductVariant`.
- `ProductVariant` (`product_variants`) — color, size, age, sku, price, stock, reservedQuantity, active.
- `ProductImage` (`product_images`) — url, mediaType (default "image").
- `Cart` (`carts`) — 1:1 with User; `CartItem` (`cart_items`) — product + optional variant + quantity; unique on (cartId, productId, productVariantId).
- `Order` (`orders`) — userId (nullable), total, status (OrderStatus), paymentStatus (PaymentStatus), vendorAccepted/Rejected, idempotencyKey (unique index), walletAmountApplied, commissionRate, platformCommission, vendorEarnings, shipping/tax, orderType (NORMAL/PREORDER/BACKORDER), fulfillmentStatus, receiptToken (unique), source, channel, paymentMethod. `OrderItem` (`order_items`) — order + product + optional variant + quantity, price, costPriceSnapshot, allocatedQuantity, shippedAt/deliveredAt/deliveryConfirmedAt.
- `Payment` (`payments`) — 1:1 with Order (orderId unique); amount, currency (default GHS), status, reference (unique), paystackRef.
- `Coupon` (`coupons`) — code (unique), type (PERCENTAGE/FIXED_AMOUNT/FREE_DELIVERY), value, minSpend, maxDiscount, usageLimit, perUserLimit, startDate/expiryDate, isActive. `CouponUsage` (`coupon_usages`).
- `FlashDeal` / `FlashDealProduct` — timed discounts; `FlashDealProduct` links product or service with dealPrice.

**Payments / payouts / refunds**
- `Refund` (`refunds`) — paymentId, orderItemId, amount (Decimal 12,2), walletAmount, idempotencyKey (unique), status (RefundStatus: PENDING/PROCESSING/PROCESSED/FAILED/NEEDS_ATTENTION), paystackRefundId, paystackStatus, retryCount, reason.
- `ReturnRequest` (`return_requests`) — orderItemId, customerId, status (ReturnStatus), reason (ReturnReason), returnRequired, quantity, policySnapshot (Json), escalationDeadline. `ReturnRequestEvent`, `ReturnRequestAttachment`.
- `VendorPayout` (`vendor_payouts`) — vendorId, storeId, amount, status (PayoutStatus), reference, paidAt. `VendorPayoutItem` (`vendor_payout_items`) — links payout to orderItem (unique). `VendorPayoutMethod` — type (MOBILE_MONEY/BANK_ACCOUNT), details (Json), isDefault.
- `VendorBalanceAdjustment` (`vendor_balance_adjustments`) — adjustmentType (CHARGEBACK/FEE_CORRECTION/MANUAL/REFUND_CLAWBACK), amount (Decimal), idempotencyKey (unique).

**Subscriptions (vendor SaaS)**
- `SubscriptionPlan` — name, priceMonthly/Yearly, productsLimit/servicesLimit, isActive, benefits (Json).
- `VendorSubscription` — vendorId (unique), planId, status (TRIAL/ACTIVE/PAST_DUE/...), billingCycle, currentPeriodStart/End, nextRenewalAt, trialEndsAt, paystackCustomerId, paystackSubscriptionId, totalPaid.
- `SubscriptionInvoice`, `SubscriptionPayment` (paystackRef), `SubscriptionUsage`, `SubscriptionFeature`, `SubscriptionHistory`.
- `lib/subscription/subscription-service.ts`, `billing-service.ts`, `feature-restriction.ts` enforce plan limits.

**Verification / KYC**
- `VendorVerificationApplication` — vendorId (unique), storeId, status (VerificationStatus), paymentReference/Status/Amount, paystackRef. `VendorVerificationKYC` (businessName, tinNumber, nationalId...), `VerificationDocument`, `VerificationPayment`, `VerificationAuditLog`, `VerificationSetting` (fee default 250.00).

**Loyalty / rewards / referrals**
- `CustomerLoyalty` — points, walletBalance, tierId, lifetimeOrders, streakDays, etc.
- `RewardPoints` (balance), `CashbackBalance`, `RewardTransaction` (type EARN/REDEEM/...), `CashbackTransaction` (source), `RewardRedemption`, `LoyaltyTier`, `Achievement`, `CustomerAchievement`.
- `ReferralRecord` — referrerId, refereeId, code (unique), status, rewardPoints/Cashback. `VendorReferral` (marketing officer → vendor, amountOwed default 25.00). `Influencer` / `InfluencerReferral` / `InfluencerClick` / `InfluencerCashback`.

**Catalog / merchandising**
- `Brand`, `ProductCategory` (hierarchical via parentId), `ServiceCategory`.
- `Service` — vendorId, categoryId, startingPrice (Decimal), pricingType, deliveryType, status (DRAFT/PUBLISHED), tags, images (ServiceImage).
- `HomepageSection` + `HomepageSectionProduct/Vendor/Brand` — curated homepage blocks.
- `AdvertisementCampaign` / `AdvertisementPlacement` / `AdvertisementPayment` / `AdvertisementInvoice` / `AdvertisementAnalytics` / `AdvertisementHistory` — sponsored placements, Paystack-backed.

**Support / content / trust**
- `SupportTicket` — userId, subject, type, status, priority, guestToken (unique), assignedAdminId. `SupportConversation` + `SupportMessage` (senderType GUEST/CUSTOMER/ADMIN/SUPER_ADMIN).
- `ProductReview` / `VendorReview` / `ServiceReview` — rating, comment, isApproved/isHidden, unique (user, target). `ReviewImage`, `ReviewVideo`, `ReviewLike`, `ReviewReport`, `VendorReply`.
- `VendorPost` / `VendorPostLike` / `VendorPostComment` / `VendorPostReport` — vendor social posts.
- `VendorTrustBadge` — badgeType (TRUSTED_VENDOR, VERIFIED_BUSINESS, ...), isActive, expiresAt.
- `SeoMetadata` — entityType/entityId unique, metaTitle/Description, OG/Twitter fields, jsonLd.
- `Notification` — userId, type (NotificationType, ~50 values), isRead.
- `AuditLog` — userId, userRole, action, entityType, entityId, beforeData/afterData (Json), ipAddress, userAgent.

**Waitlist / misc**
- `AppWaitlistEntry` — email (unique), name, phone, platform, role, source, referredByCode.
- `WaitlistSignup` — fullName, email, phone, interest, device, consent, utmMedium/Campaign.
- `Session` — sessionId (unique), userId, device/browser/os, ipAddress, location, userAgent, isExpired, expiredAt.
- `AuthToken` — tokenType (EMAIL_VERIFICATION/PASSWORD_RESET/OTP_LOGIN/OTP_MFA), tokenHash, expiresAt, selector (unique).
- `PendingRegistration` — email (unique), hashedOTP, otpExpiresAt, hashedPassword, role.
- `RecentlyViewed`, `SearchHistory`, `Recommendation`, `ProductCompare`, `Collection`/`CollectionItem`, `SavedSearch`, `VendorAnalytics`, `MarketplaceKPI`, `SearchSuggestion`, `ExitIntent`, `StickyButton`, `PlatformPolicy` (singleton), `AdminSettings`/`VendorSettings`/`SuperAdminSettings`.

## Authentication and authorization approach

- **Auth library:** `lib/auth.ts` (server, `jsonwebtoken`) and `lib/auth-edge.ts` (edge, `jose`). Both verify the same JWT shape `{userId, role, sessionId}`. `lib/auth-middleware.ts` is the server-side verifier used by route handlers; it additionally checks the `Session` table and user ACTIVE status.
- **Password:** bcryptjs, 12 rounds (`lib/auth.ts:12`, `hashPassword`/`verifyPassword`).
- **Token:** JWT signed with `JWT_SECRET`, expiresIn 7d (`lib/auth.ts:23`). Cookie `token`, httpOnly, secure in production, sameSite lax, maxAge 7 days (30 if rememberMe) — `app/api/auth/login/route.ts:120`, `register/route.ts:312`.
- **Session table:** `Session` row created on login/register; used for revocation/expiry (`lib/auth-middleware.ts:35-50`). Login also auto-claims daily loyalty reward for customers (`app/api/auth/login/route.ts:84-106`).
- **Registration:** public for CUSTOMER/VENDOR only; SUPER_ADMIN blocked (`register/route.ts:46`). Email OTP flow when email service enabled: `PendingRegistration` stores hashed OTP (10 min expiry), email sent via `sendEmailVerificationEmail` (`lib/email.ts`). Without email service, user created verified immediately.
- **Middleware role ACL:** `middleware.ts:8-14`; redirects unauthenticated to `/login` with `?redirect=`. Role mismatches redirect to `/`.
- **Admin/super-admin:** `SuperAdminSettings` (`platformFee` default 2.5, `maintenanceMode`, `registrationOpen`, `allowedAdminIps`). Super-admin role set directly in DB (README.md:143).

## Payment, order, and checkout flow

1. Customer adds items to cart (`POST /api/cart/items`, `GET /api/cart`).
2. `POST /api/checkout` (`app/api/checkout/route.ts`):
   - Rate-limited (`rateLimit('checkout')`), auth required.
   - Loads cart with items + products + variants + stores; validates stock (skips PREORDER/BACKORDER).
   - Calculates subtotal via `getUnitPrice` (`lib/pricing.ts`); applies wallet balance (customerLoyalty.walletBalance) if requested.
   - Passes Paystack processing fee to customer: `processingFee = effectiveTotal/(1-PAYSTACK_FEE_PERCENTAGE) - effectiveTotal`; `PAYSTACK_FEE_PERCENTAGE` from `lib/site-config.ts`.
   - Idempotency: checks recent order by `idempotencyKey` within 10 min (generates `crypto.randomUUID()` if absent).
   - Creates Order + Payment + OrderItems in a Prisma transaction; clears cart only on payment success.
   - Initializes Paystack (`initializePaystackPayment`) → returns `authorization_url`; client redirects to Paystack.
3. Payment verification (two paths, both idempotent on `payment.status === 'PAID'`):
   - Client: `POST /api/payment/verify` (`app/api/payment/verify/route.ts`) verifies reference via `verifyPaystackPayment`, updates Payment/Order to PAID/PROCESSING, computes financial breakdown (`calculateFinancialBreakdown`), clears cart, reserves stock via `reserveStock` (`SELECT ... FOR UPDATE`), sends emails/notifications, checks influencer referral qualification.
   - Webhook: `POST /api/webhook/paystack` → `lib/webhooks/order-webhook-handler.ts`; verifies Paystack HMAC-SHA512 signature (`verifyPaystackSignature`); same post-payment processing. Duplicate-webhook safe via early return when already PAID.
4. Fulfillment: `Order.fulfillmentStatus` (PENDING → ... → DELIVERED); `FulfillmentEvent` records; `recordFulfillmentEvent` (`lib/fulfillment-events.ts`). Inventory consumed via `consumeInventory` when order delivered/confirmed.
5. Refunds: `Refund` rows; `createPaystackRefund`/`listPaystackRefunds`/`fetchPaystackRefund`/`retryPaystackRefundWithCustomerDetails` (`lib/paystack.ts`); webhook handlers `lib/webhooks/refund-webhook-handler.ts`, `subscription-webhook-handler.ts`, `verification-webhook-handler.ts`, `advertising-webhook-handler.ts`.

## Background jobs, webhooks, and external API calls

**Webhooks (Paystack):**
- `app/api/webhook/paystack/route.ts` (unverified, need to read) — dispatches to handlers in `lib/webhooks/`: `order-webhook-handler.ts`, `refund-webhook-handler.ts`, `subscription-webhook-handler.ts`, `verification-webhook-handler.ts`, `advertising-webhook-handler.ts`. All verify HMAC-SHA512 signature with `PAYSTACK_SECRET_KEY`.

**External API calls:**
- Paystack (initialize/verify/refund/list/fetch/retry) — `lib/paystack.ts`, 15s timeout, AbortController, no body logging.
- Cloudinary — `lib/cloudinary.ts`, `lib/cloudinary-image.ts`; scripts `upload-images-to-cloudinary.ts`, `upload-videos-to-cloudinary.ts`; images served from `res.cloudinary.com` (next.config.js:32-53).
- Resend / Brevo — optional email (`lib/email.ts`); `RESEND_API_KEY`, `BREVO_API_KEY` in `.env.example`. `FailedEmail` table for retry (`schema.prisma:1825`).
- Turnstile (Cloudflare captcha) — optional (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
- Google Analytics — `components/GoogleAnalytics.tsx`, `lib/gtag.ts`.
- Sentry — `@sentry/nextjs` in `next.config.js:179-195`, gated on `SENTRY_DSN`.

**Background / recurring:** No visible queue (no Bull/RabbitMQ). Async work is fire-and-forget `.catch()` within route handlers (emails, notifications, events, audit logs). Cron-ish: `app/api/cron/` exists (unverified contents). One-off maintenance is done via 49 scripts in `scripts/` (backfills, migrations, diagnostics, backups). `prisma migrate deploy` runs on `npm start`.

**Caching:** `withCache` in `lib/prisma.ts:79` (in-memory Map, TTL default 60s, cap 500 entries). `lib/revenue.ts` caches platform fee 60s. `lib/trust/cached-profile.ts` for trust profiles.

Stopping after stage 2 for confirmation.
