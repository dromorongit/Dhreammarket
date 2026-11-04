# Dhream Market — Stage 4 Quality, Security, Performance Findings

**Source of truth:** repository at `C:\Users\Dromor Narh\Desktop\GithubRepos\Dhream Market`. Read-only audit; no source files modified.

Severity key: **high** = likely exploit or data/availability impact; **medium** = likely bug, partial exposure, or operational risk; **low** = hygiene / dead code / misleading comment.

## High

**H1 — Build safety disabled (type + lint errors do not fail builds)**
`next.config.js:9-14` sets `typescript.ignoreBuildErrors: true` and `eslint: { ignoreDuringBuilds: true }`. A `npm run build` succeeds even with TypeScript or ESLint errors, so broken or unsafe code can ship to production.
Suggested fix: remove both flags; run `npm run lint` and `tsc --noEmit` in CI and fix failures before deploy.

**H2 — Auth-related process errors swallowed at entry point**
`server-entry.js:3-51` catches JWT unhandled rejections and uncaught exceptions (`ERR_JWT_EXPIRED`, `ERR_JWT_INVALID`, etc.), logs them, and continues the process. This masks authentication failures instead of failing closed or alerting.
Suggested fix: remove the JWT error swallowing; route auth errors through Sentry (`next.config.js:179-195`) and let the process crash on genuine uncaught exceptions so orchestrator restarts and alerts fire.

## Medium

**M1 — Stock reservation uses per-item row locks in a loop (N+1 / lock contention)**
`lib/stock-reservation.ts:42-90` (`reserveStock`) and `lib/stock-reservation.ts:411-470` (`consumeInventory`) run `SELECT ... FOR UPDATE` on `products`/`product_variants` once per cart item inside a Prisma transaction. Under concurrent checkout this serializes on hot products and increases transaction lock duration.
Suggested fix: batch the lock/update into a single set-based query (e.g., one `UPDATE ... FROM UNNEST` or a single transaction with bulk increment) to reduce lock count and duration.

**M2 — In-memory cache is per-process only (not distributed)**
`lib/prisma.ts:79-95` (`withCache`) stores cache in a module-level `Map` with 60s default TTL and 500-entry cap. On serverless/standalone deployments with multiple instances, each process has its own cache, so cache invalidation is inconsistent and memory grows per instance.
Suggested fix: document the limitation, shorten TTL, or back the cache with Redis for multi-instance consistency.

**M3 — Vendor stock metrics loads all products into memory and sums in JS**
`lib/stock-reservation.ts:320-342` (`getVendorStockMetrics`) does `store: { include: { products: true } }` then iterates in JavaScript to sum `stock`/`reservedQuantity`. For vendors with large catalogs this loads many rows and can OOM / slow.
Suggested fix: aggregate in SQL (`SELECT SUM(stock), SUM("reservedQuantity") FROM products WHERE storeId = ...`).

**M4 — Webhook rate limiting unverified / possibly absent**
Middleware `middleware.ts:31-47` passes `/api/*` through without rate limiting; `lib/webhooks/order-webhook-handler.ts` (and siblings in `lib/webhooks/`) do not call `rateLimit()`. Paystack webhooks could be flooded. Status: unverified whether another layer protects them.
Suggested fix: add `rateLimit('webhook')` to `app/api/webhook/paystack/route.ts` and confirm no other protection exists.

**M5 — Console logging in auth flow**
`app/api/auth/login/route.ts:79-81` logs `NODE_ENV` and cookie secure flag on every login. No secret is printed, but it's noisy and could leak deployment context in logs.
Suggested fix: remove the `console.log` statements (lines 79-81).

**M6 — Oversell window between checkout and payment verification**
`app/api/checkout/route.ts:95-108` validates stock at checkout but does not reserve stock; reservation happens in payment verify/webhook via `reserveStock`. Two concurrent checkouts for the last unit can both pass validation; `reserveStock`'s `FOR UPDATE` serializes them but only at verify time, so one will fail late after the customer already initiated Paystack.
Suggested fix: reserve stock at checkout (or hold a short-lived lock) and re-validate/fulfill atomically at payment verify.

## Low

**L1 — Stale/misleading comment**
`app/api/orders/route.ts:154-156` claims a read without `select` loads every column, but the query at lines 157-167 explicitly uses `select`. Comment is inaccurate.
Suggested fix: remove or correct the comment.

**L2 — Dead Pages Router remnant**
`pages/_app.tsx` is the only file in `pages/`; App Router (`app/`) is the active UI layer. Dead code.
Suggested fix: remove `pages/_app.tsx` unless it's intentionally kept for a legacy route.

**L3 — Unwired refund-retry helper**
`lib/paystack.ts:431-482` (`retryPaystackRefundWithCustomerDetails`) is documented as "kept unwired: there is no admin endpoint that submits corrected bank details yet." Dead code path for needs-attention refunds.
Suggested fix: wire an admin endpoint to submit bank details, or remove the helper.

**L4 — Test coverage threshold unverified in CI**
`vitest.config.ts:15-20` sets 85% coverage thresholds on `lib/**/*.ts` and `app/api/**/*.ts`; no evidence in repo that a CI gate enforces it. 154 test files exist but coverage status unknown.
Suggested fix: add a CI step running `npm run test:coverage` and enforce thresholds.

**L5 — Dependency / config hygiene**
`tsconfig.tsbuildinfo` is generated and gitignored (`.gitignore:41`); `next.config.js` pins `output: 'standalone'` and `server-entry.js` loads `.next/standalone/server.js`. Works but tightly couples start to build output.
Suggested fix: document the build-then-start dependency in deployment runbook (README.md:101-108 covers Railway but not standalone-server specifics).

## What's done well (no finding)
- `lib/env-validation.ts:24-43` enforces required env vars (`DATABASE_URL`, `JWT_SECRET`) at startup and aborts if missing.
- `lib/paystack.ts` never logs secret keys; `logConfigurationOnce` logs only a boolean (`lib/paystack.ts:208-213`).
- `.env` is gitignored (`.gitignore:34`); only `.env.example` is committed.
- Webhook signature verification uses `crypto.timingSafeEqual` (`lib/webhooks/order-webhook-handler.ts:14-27`).
- Password hashing uses bcryptjs 12 rounds (`lib/auth.ts:12`).
- `Payment`/`Refund` use idempotency keys with early-return when already processed (`app/api/payment/verify/route.ts:122`, `lib/webhooks/order-webhook-handler.ts:82`).

Stopping after stage 4 for confirmation.
