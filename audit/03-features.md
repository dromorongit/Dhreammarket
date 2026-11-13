# Dhream Market — Stage 3 Feature Map

**Source of truth:** repository at `C:\Users\Dromor Narh\Desktop\GithubRepos\Dhream Market`. Read-only audit; no source files modified.

Status key: **complete** = implemented UI + API + DB; **partial** = implemented but missing UI or limited; **stub** = route/model exists with little or no logic.

## Buyer-side features

| Feature | Status | Implementing files |
|---|---|---|
| Homepage (curated sections, ads, trending, official stores) | complete | `app/page.tsx`, `components/home/HomeClient.tsx`, `components/home/*`, `app/api/homepage/*` |
| Product catalog + marketplace browsing | complete | `app/marketplace/`, `app/api/products/`, `app/marketplace/product/[id]/` |
| Product detail page | complete | `app/marketplace/product/[id]/`, `components/ProductBadges.tsx`, `components/ProductStockIndicator.tsx` |
| Services catalog + detail | complete | `app/services/`, `app/services/[slug]/`, `app/api/services/` |
| Service request / quote request | complete | `app/services/request/`, `app/api/service-requests/`, `lib/service-request-utils.ts` |
| Search | complete | `app/search/`, `app/api/search/`, `app/api/search-upgraded/` |
| Product compare | complete | `app/compare/`, `app/api/compare/`, `ProductCompare` model |
| Cart | complete | `app/cart/`, `app/api/cart/route.ts`, `app/api/cart/items/`, `lib/CartContext.tsx` |
| Checkout + Paystack payment | complete | `app/checkout/`, `app/api/checkout/route.ts`, `app/api/payment/verify/`, `lib/paystack.ts` |
| Order history / tracking | complete | `app/dashboard/customer/orders/`, `app/api/orders/`, `app/api/orders/[orderId]/` |
| Wishlist | complete | `components/WishlistButton.tsx`, `app/api/wishlist/`, `Wishlist`/`WishlistItem` models |
| Coupons / discount codes | complete | `app/coupons/`, `app/api/coupons/`, `Coupon`/`CouponUsage` models |
| Flash deals | complete | `app/flash-deals/`, `app/api/flash-deals/`, `FlashDeal`/`FlashDealProduct` models |
| Product reviews (ratings, images, video, likes, reports, vendor replies) | complete | `components/Review*.tsx`, `components/ReviewReportForm.tsx`, `ProductReview`/`ReviewImage`/`ReviewVideo`/`ReviewLike`/`ReviewReport`/`VendorReply` models |
| Vendor reviews | complete | `VendorReview`/`VendorReviewReply` models, `app/api/super-admin/reviews/` |
| Loyalty points, tiers, achievements, cashback, wallet | complete | `components/loyalty/*`, `app/dashboard/customer/loyalty/`, `app/api/loyalty/`, `CustomerLoyalty`/`RewardPoints`/`CashbackBalance`/`LoyaltyTier`/`Achievement` models |
| Referrals (referral code, referral signup) | complete | `User.referralCode`, `ReferralRecord`, `lib/loyalty/process-referral-signup.ts` |
| Influencer attribution & cashback | complete | `lib/influencer/*`, `Influencer`/`InfluencerReferral`/`InfluencerCashback` models |
| Returns / refund requests | complete | `app/refund/`, `app/dashboard/customer/returns/`, `app/api/returns/`, `lib/refunds/`, `ReturnRequest`/`Refund` models |
| Support tickets + AI support chat | complete | `app/help/`, `app/api/support/`, `app/api/support-ai/chat/`, `lib/support-ai/*`, `components/support-ai/*`, `SupportTicket`/`SupportMessage` models |
| Waitlist signup | complete | `app/app-waitlist/`, `app/api/waitlist/`, `WaitlistSignup`/`AppWaitlistEntry` models, README.md:130-144 |
| Account / profile / settings (password, avatar, notifications, preferences) | complete | `app/dashboard/customer/profile/`, `app/dashboard/customer/settings/`, `components/settings/*`, `components/account/ChangePasswordCard.tsx`, `Profile`/`NotificationPreference` models |
| Login / register / verify-email / forgot-password / reset-password | complete | `app/login/`, `app/register/`, `app/verify-email/`, `app/forgot-password/`, `app/reset-password/`, `app/api/auth/*`, `lib/auth.ts` |
| Recently sold / trending | complete | `app/recently-sold/`, `app/api/recently-sold/`, `RecentlySold` model |
| Recently viewed | partial | `lib/recently-viewed.ts`, `components/RecentlyViewed.tsx`, `RecentlyViewed` model; no dedicated buyer page |
| Saved searches / collections | complete | `app/api/saved-searches/`, `app/api/collections/`, `SavedSearch`/`Collection`/`CollectionItem` models |
| Contact / FAQ / help center | complete | `app/contact/`, `app/faq/`, `app/help-center/`, `Feedback` model |
| Static legal pages (terms, privacy, payment-policy, about, FAQ) | complete | `app/terms/`, `app/privacy/`, `app/payment-policy/`, `app/about/`, `app/faq/` |

## Seller-side (vendor dashboard) features

| Feature | Status | Implementing files |
|---|---|---|
| Vendor dashboard home | complete | `app/dashboard/vendor/page.tsx`, `app/dashboard/vendor/layout.tsx` |
| Store setup & profile | complete | `app/dashboard/vendor/store/`, `Store` model, `app/api/vendor/...` |
| Product management (CRUD, images, variants, stock, flash-sale pricing) | complete | `app/dashboard/vendor/products/`, `app/api/vendor/products/`, `Product`/`ProductVariant`/`ProductImage` models |
| Service management | complete | `app/dashboard/vendor/services/`, `app/api/vendor/services/`, `Service`/`ServiceImage`/`ServiceCategory` models |
| Vendor orders management | complete | `app/dashboard/vendor/orders/`, `app/api/vendor/orders/` |
| Order fulfillment + fulfillment events | complete | `app/dashboard/vendor/fulfillment/`, `lib/fulfillment-events.ts`, `FulfillmentEvent` model |
| Earnings & payouts (mobile money / bank account) | complete | `app/dashboard/vendor/earnings/`, `app/dashboard/vendor/payouts/`, `app/dashboard/vendor/payout-methods/`, `app/api/vendor/payouts/`, `VendorPayout`/`VendorPayoutMethod`/`VendorPayoutItem`/`VendorBalanceAdjustment` models |
| Vendor advertising campaigns | complete | `app/dashboard/vendor/advertising/`, `app/api/vendor/advertising/`, `AdvertisementCampaign`/`AdvertisementPlacement` models |
| Vendor customers (VendorCustomer) | complete | `app/dashboard/vendor/customers/`, `app/api/vendor/customers/`, `VendorCustomer` model |
| Suppliers / purchase orders / restock orders | complete | `app/dashboard/vendor/suppliers/`, `app/dashboard/vendor/purchase-orders/`, `app/dashboard/vendor/restock/`, `lib/supplier-procurement.ts`, `Supplier`/`PurchaseOrder`/`RestockOrder` models |
| Vendor service requests & quotations | complete | `app/dashboard/vendor/service-requests/`, `ServiceRequest`/`ServiceQuotation`/`QuotationAttachment` models |
| Vendor returns handling | complete | `app/dashboard/vendor/returns/`, `app/api/vendor/returns/` |
| Vendor subscription & billing | complete | `app/dashboard/vendor/subscription/`, `app/api/subscription/vendor/`, `lib/subscription/*`, `VendorSubscription`/`SubscriptionPlan` models |
| Vendor verification / KYC application | complete | `app/dashboard/vendor/verification/`, `app/api/vendor/verification/`, `VendorVerificationApplication`/`VendorVerificationKYC`/`VerificationDocument` models |
| Vendor analytics | complete | `app/dashboard/vendor/analytics/`, `app/api/vendor/analytics/`, `VendorAnalytics` model |
| Vendor feed / social posts (likes, comments, reports) | complete | `app/dashboard/vendor/feed/`, `VendorPost`/`VendorPostLike`/`VendorPostComment`/`VendorPostReport` models |
| Vendor followers | complete | `app/dashboard/vendor/followers/`, `VendorFollow` model |
| Quick-sale / manual orders (off-platform) | complete | `app/dashboard/vendor/quick-sale/`, `lib/manual-orders.ts`, `Order.source=MANUAL` |
| Procurement / stock allocation | complete | `app/dashboard/vendor/procurement/`, `lib/stock-reservation.ts`, `lib/restock-procurement.ts` |
| Sales summary | complete | `app/dashboard/vendor/sales/`, `lib/vendor-sales-data.ts`, `app/api/vendor/sales-summary/` |
| Vendor settings | complete | `app/dashboard/vendor/settings/`, `VendorSettings` model |
| Vendor badge tier / trust badge | complete | `Store.badgeTier`, `VendorTrustBadge`, `components/trust/SellerTrustProfileCard.tsx` |

## Admin-side features

| Feature | Status | Implementing files |
|---|---|---|
| Admin dashboard (users, orders, products, categories, vendors, payments, payouts, advertisements, audit logs, refund requests, returns, support, settings) | complete | `app/dashboard/admin/`, `app/api/admin/*` |
| Waitlist export + admin view | complete | `app/admin/waitlist/`, `app/api/admin/waitlist/`, `npm run export:waitlist`, README.md:135-144 |

## Super-admin features

| Feature | Status | Implementing files |
|---|---|---|
| Platform settings (maintenance mode, platform fee, allowed admin IPs, etc.) | complete | `app/dashboard/super-admin/settings/`, `SuperAdminSettings` model |
| Subscription plan management | complete | `app/dashboard/super-admin/subscription/`, `app/api/subscription/admin/`, `SubscriptionPlan`/`SubscriptionFeature` models |
| Brands | complete | `app/dashboard/super-admin/brands/`, `Brand` model |
| Product categories & service categories | complete | `app/dashboard/super-admin/product-categories/`, `service-categories/`, `ProductCategory`/`ServiceCategory` models |
| Coupons | complete | `app/dashboard/super-admin/coupons/`, `Coupon` model |
| Flash deals | complete | `app/dashboard/super-admin/flash-deals/`, `FlashDeal` model |
| Homepage sections (merchandising) | complete | `app/dashboard/super-admin/homepage/`, `HomepageSection` models |
| Influencers + influencer referrals | complete | `app/dashboard/super-admin/influencers/`, `influencer-referrals/`, `Influencer`/`InfluencerReferral` models |
| Marketing officers | complete | `app/dashboard/super-admin/marketing-officers/`, `MarketingOfficer`/`VendorReferral` models |
| Marketplace intelligence / KPI | complete | `app/dashboard/super-admin/marketplace-intelligence/`, `MarketplaceKPI` model |
| Reviews moderation | complete | `app/dashboard/super-admin/reviews/` |
| Service requests oversight | complete | `app/dashboard/super-admin/service-requests/` |
| Trust badges | complete | `app/dashboard/super-admin/trust-badges/`, `VendorTrustBadge` model |
| Vendor categories | complete | `app/dashboard/super-admin/vendor-categories/`, `VendorCategory` model |
| Verification settings | complete | `app/dashboard/super-admin/verification-settings/`, `VerificationSetting` model |
| Waitlist admin | complete | `app/dashboard/super-admin/waitlist/`, `app/api/super-admin/...` |
| Advertising oversight | complete | `app/dashboard/super-admin/advertising/`, `app/api/super-admin/advertising/` |

## Influencer-side features

| Feature | Status | Implementing files |
|---|---|---|
| Influencer dashboard | stub | `app/dashboard/influencer/page.tsx` only (single page, minimal) |
| Influencer referral attribution, cashback, signup bonus | complete | `lib/influencer/*`, `Influencer`/`InfluencerReferral`/`InfluencerCashback` models |

## Marketing-officer features

| Feature | Status | Implementing files |
|---|---|---|
| Vendor referral (amountOwed default 25.00) | complete | `VendorReferral`/`MarketingOfficer` models, `register/route.ts:173-188` |

## Cross-cutting

| Feature | Status | Implementing files |
|---|---|---|
| Authentication (JWT, bcrypt, Session table, email OTP) | complete | `lib/auth.ts`, `lib/auth-edge.ts`, `lib/auth-middleware.ts`, `middleware.ts`, `app/api/auth/*` |
| Role-based access control (CUSTOMER/VENDOR/ADMIN/SUPER_ADMIN/INFLUENCER) | complete | `middleware.ts:8-14`, route handlers, `Role` enum |
| Rate limiting (edge + API) | complete | `lib/edge-rate-limit.ts`, `lib/rate-limit.ts`, `middleware.ts` |
| Audit logging | complete | `lib/audit-log.ts`, `AuditLog` model |
| Stock reservation / inventory consumption (SELECT FOR UPDATE) | complete | `lib/stock-reservation.ts` |
| Paystack webhooks (order, refund, subscription, verification, advertising) | complete | `app/api/webhook/paystack/`, `lib/webhooks/*` |
| SEO metadata + JSON-LD | complete | `SeoMetadata` model, `components/seo/*` |
| Notifications (in-app, email preferences) | complete | `lib/notifications.ts`, `lib/notification-preferences.ts`, `Notification` model |
| Feature flags | complete | `lib/feature-flags.ts` |
| Sentry monitoring | complete | `next.config.js:179-195`, `instrumentation.ts`, `instrumentation-client.ts` |

## Tests

- 154 test files colocated as `*.test.ts`/`*.test.tsx` across `app/`, `lib/`, `components/`, `scripts/`.
- Vitest configured (`vitest.config.ts`): 85% coverage threshold on `lib/**/*.ts` and `app/api/**/*.ts`; Playwright E2E in `playwright/`.
- No separate `test/` directory.

## TODO / FIXME / stub indicators

No explicit `TODO`/`FIXME`/`HACK`/`XXX` markers found in source (grep returned only incidental placeholder text and comments). Notable gaps/stubs inferred from structure:
- Influencer dashboard is a stub (`app/dashboard/influencer/page.tsx` only).
- `retryPaystackRefundWithCustomerDetails` is "kept unwired" — no admin endpoint submits corrected bank details yet (`lib/paystack.ts:428-429`).
- Recently viewed has lib + components but no dedicated buyer page.
- Pages Router remnant: `pages/_app.tsx` only; App Router is the active UI layer.

Stopping after stage 3 for confirmation.
