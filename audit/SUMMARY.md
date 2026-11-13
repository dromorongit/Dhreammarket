# Dhream Market — Audit Summary

**Product purpose:** Dhream Market is a Phase 1 two-sided marketplace foundation for digital trade in Ghana ("The Trusted Home of Ghanaian Trade Online"). Buyers browse and purchase products and services from verified vendors; sellers run stores via a vendor dashboard; admins/super-admins moderate the platform. Roles: CUSTOMER, VENDOR, ADMIN, SUPER_ADMIN, INFLUENCER.

**Stack:** Next.js 14 App Router, React 18, TypeScript 5.9, Tailwind CSS; PostgreSQL via Prisma ORM (schema `prisma/schema.prisma`, 3282 lines, ~60 models); JWT (jsonwebtoken/jose) + bcryptjs auth in `token` cookie with a `Session` table; Paystack payments; Cloudinary media; Sentry monitoring; TanStack Query; Vitest + Playwright. Node 18+, deploys to Railway as a standalone Next.js build (`server-entry.js`).

**Architecture (5 bullets):**
- Request flows browser → App Router → `middleware.ts` (role ACL on `/dashboard/*` and `/api/*`) → route handler that verifies the JWT cookie against the `Session` table (`lib/auth-middleware.ts`) → Prisma/pg → PostgreSQL.
- Checkout (`app/api/checkout/route.ts`) creates Order+Payment, initializes Paystack; payment is verified client-side (`app/api/payment/verify/route.ts`) or via Paystack webhook (`lib/webhooks/order-webhook-handler.ts`, HMAC-SHA512 verified), both idempotent.
- Stock uses `SELECT ... FOR UPDATE` reservation (`lib/stock-reservation.ts`) then `consumeInventory` decrements stock on fulfillment.
- Platform commission (~2.5% from `SuperAdminSettings.platformFee`) splits order totals into platform/vendor earnings (`lib/revenue.ts`); refunds/returns and vendor payouts (mobile money/bank) are modeled.
- Subscriptions, loyalty/rewards/cashback, referrals/influencer attribution, advertising campaigns, verification/KYC, support tickets + AI chat, and waitlist complete the marketplace surface.

**Top 10 findings by severity:**
1. High — `next.config.js:9-14` disables TypeScript and ESLint failures during build (`ignoreBuildErrors`, `ignoreDuringBuilds`); broken code can ship.
2. High — `server-entry.js:3-51` swallows JWT unhandled rejections/uncaught exceptions, masking auth failures.
3. Medium — `lib/stock-reservation.ts:42-90,411-470` per-item `SELECT ... FOR UPDATE` loops cause N+1 lock contention.
4. Medium — `lib/prisma.ts:79-95` in-memory `Map` cache is per-process only, inconsistent across instances.
5. Medium — `lib/stock-reservation.ts:320-342` loads all vendor products into memory to sum stock.
6. Medium — webhook rate limiting unverified/possibly absent (`lib/webhooks/`, `middleware.ts` passes `/api/*` through).
7. Medium — `app/api/auth/login/route.ts:79-81` logs auth-flow details.
8. Medium — stock validated at checkout but reserved only at payment verify (`app/api/checkout/route.ts` vs `lib/stock-reservation.ts`), an oversell window.
9. Low — stale comment `app/api/orders/route.ts:154-156`.
10. Low — dead Pages Router remnant `pages/_app.tsx`; unwired refund retry `lib/paystack.ts:431-482`.

**Suggested next steps:**
1. Remove `ignoreBuildErrors`/`ignoreDuringBuilds`; enforce `npm run lint` and typecheck in CI.
2. Stop swallowing JWT errors in `server-entry.js`; route to Sentry.
3. Batch stock locks into set-based queries; aggregate vendor stock metrics in SQL.
4. Add rate limiting to `/api/webhook/paystack`; back the cache with Redis or shorten TTL.
5. Reserve stock at checkout to close the oversell window.
6. Run `npm run test:coverage` in CI against the 85% threshold; remove `pages/_app.tsx`.
