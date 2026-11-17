# Dhream Market — Seller Commerce OS Feature Audit

**Scope:** Mobile-first commerce OS for Ghanaian sellers (9-feature product spec).
**Method:** Read-only audit of API routes, lib modules, Prisma schema, vendor UI pages, middleware, cron jobs, and prior audit docs. No code changes.
**Status labels:** COMPLETE / PARTIAL / STUB / MISSING

---

## A. Executive Summary

| # | Feature | Status | Core finding |
|---|---------|--------|--------------|
| 1 | Online marketplace checkout | COMPLETE | Cart → Paystack init → order + stock reservation + webhook confirmation all wired. |
| 2 | Unified order inbox | COMPLETE | `source` (ONLINE/MANUAL) + `channel` (WhatsApp/IG/FB/Call/Walk-in/Other) on Order; vendor orders list + detail UI present. |
| 3 | Payment links (Paystack) | PARTIAL | API + UI exist but gated behind `PAYLINK_ENABLED` flag defaulting `false`; 503 returned when off. |
| 4 | Order status fulfillment pipeline | COMPLETE | Manual-order status transitions (PENDING→PROCESSING→SHIPPED→DELIVERED→COMPLETED) enforced client + API side. |
| 5 | Digital receipts | COMPLETE | Public-by-token receipt page, Print/Pay Now buttons, WhatsApp share link; receipt token stored on Order. |
| 6 | Refunds | COMPLETE | Refund service with idempotency keys, caps, wallet rules; Paystack refund webhook with signature verification. |
| 7 | Stock management / overselling | PARTIAL | `reserveStock`/`consumeInventory` with `SELECT ... FOR UPDATE` exist; per-item loop → contention risk; no async reservation release SLA enforcement beyond cron. |
| 8 | Low-stock alerts | PARTIAL | Cron + in-app notifications exist; email/SMS delivery channels declared in templates but not wired to a real SMS provider. |
| 9 | Daily sales summary / reporting | COMPLETE | `lib/sales-summary.ts` pure module + cron + CSV export + sales dashboard page; Africa/Accra day boundaries; cost-coverage flags. |

**Overall:** The backend API surface for all 9 features is present. UI coverage is strong for vendor dashboards. The main gaps are: pay links disabled by default, SMS notification channel declared but no SMS provider integrated, stock reservation contention risk, and hardcoded secrets in `.env`.

---

## B. Per-Feature Detail

### Feature 1 — Online marketplace checkout (cart → Paystack → order)

**Status: COMPLETE**

- `app/api/checkout/route.ts` creates an online order, calls Paystack to initialize payment, reserves stock via `lib/stock-reservation.ts`, and persists `payToken`/`paymentLinkExpiresAt`/`idempotencyKey` on the Order.
- `lib/webhooks/order-webhook-handler.ts` verifies Paystack webhook signature, marks order PAID, consumes inventory, clears reservation.
- Idempotency handled via `idempotencyKey`; duplicate payment intents rejected.
- Stock reservation uses `SELECT ... FOR UPDATE` per item (see Feature 7 caveat).

**Bugs/gaps:** None blocking. Stock-reservation per-item lock loop is a contention risk under high concurrency (carried to Feature 7).

**Key files:** `app/api/checkout/route.ts`, `lib/webhooks/order-webhook-handler.ts`, `lib/stock-reservation.ts`, `lib/paystack.ts`

### Feature 2 — Unified order inbox (manual + online)

**Status: COMPLETE**

- `Order.source` (ONLINE/MANUAL) and `Order.channel` (WHATSAPP/INSTAGRAM/FACEBOOK/CALL/WALK_IN/OTHER) on the Order model.
- `app/api/vendor/manual-orders/route.ts` creates manual orders with customer lookup/creation (`VendorCustomer`), channel, delivery fee/cost, mark-paid option, idempotency key, receipt token.
- `app/api/vendor/orders/route.ts` lists vendor orders with pagination, search, status/source/channel/unpaid/toDispatch filters and counts.
- `app/api/vendor/orders/[orderId]/route.ts` handles status transitions + delivery-cost edits.
- Vendor UI: `app/dashboard/vendor/orders/page.[client].tsx` shows order list with source/channel badges, pay-link status chips, manual status transitions, unpaid/toDispatch filter modes.
- Vendor UI: `app/dashboard/vendor/customers/page.[client].tsx` customer directory with search, pagination, detail/edit (tags/notes), last-ordered items.
- Vendor UI: `app/dashboard/vendor/quick-sale/page.[client].tsx` quick-sale form (cart, product search, variants, custom price, repeat prefill, channel, mark paid, delivery fee/cost) → creates manual order.

**Bugs/gaps:** None blocking.

**Key files:** `app/api/vendor/manual-orders/route.ts`, `app/api/vendor/orders/route.ts`, `app/dashboard/vendor/quick-sale/page.client.tsx`, `app/dashboard/vendor/orders/page.client.tsx`

### Feature 3 — Payment links (Paystack)

**Status: PARTIAL**

- `app/api/vendor/manual-orders/[orderId]/pay-link/route.ts` creates a Paystack payment link for a manual order, gated by `process.env.PAYLINK_ENABLED === 'true'`; returns 503 when off.
- `app/api/receipt/[token]/pay/route.ts` public pay-now page by receipt token (initializes Paystack, marks order PAID on webhook).
- Vendor UI quick-sale success screen shows "Send pay link on WhatsApp" / "Copy pay link" buttons (only when `effectivePayLinkEnabled`).
- `PAYLINK_ENABLED` defaults to `false` → pay links unavailable out of the box unless the flag is explicitly set.

**Bugs/gaps:** Feature flag default `false` means the core "share a payment link, customer pays" flow is disabled by default (P0). The pay-link route returns 503 with message "Pay links are not available yet" when off — graceful but non-functional.

**Key files:** `app/api/vendor/manual-orders/[orderId]/pay-link/route.ts`, `app/api/receipt/[token]/pay/route.ts`, `app/dashboard/vendor/quick-sale/page.client.tsx`

### Feature 4 — Order status fulfillment pipeline

**Status: COMPLETE**

- Manual-order status transitions enforced: `MANUAL_STATUS_TRANSITIONS` (PENDING→PROCESSING→SHIPPED→DELIVERED→COMPLETED→CANCELLED) in `app/dashboard/vendor/orders/page.client.tsx` and mirrored server-side in `app/api/vendor/orders/[orderId]/route.ts`.
- `Order.fulfillmentStatus` field present on the model.
- Vendor acceptance (`vendorAccepted`/`vendorRejected`) tracked on Order.
- `handleManualAction` in orders UI drives pay/ship/deliver/complete/cancel.

**Bugs/gaps:** None blocking. Online-order fulfillment status is less granular (driven by webhook + payment status) but acceptable per spec.

**Key files:** `app/api/vendor/orders/[orderId]/route.ts`, `app/dashboard/vendor/orders/page.client.tsx`

### Feature 5 — Digital receipts

**Status: COMPLETE**

- `Order.receiptToken` + `Order.receiptUrl` stored on order creation (manual and online).
- `app/receipt/[token]/page.tsx` public receipt page (no auth, rate-limited by middleware), `not-found.tsx` for invalid tokens.
- `app/receipt/[token]/PrintButton.tsx`, `PayNowButton.tsx`, `PaymentConfirmingNotice.tsx`.
- `lib/receipts.ts` builds receipt data incl. store contact (WhatsApp/phone fallback), customer info, items, totals, profit/cost.
- Vendor UI sales page renders `whatsappReminderLink` (wa.me deep link) for unpaid orders with receipt token.

**Bugs/gaps:** None blocking. Receipt pages are public-by-token (intended); rate-limited at edge (60/min/IP).

**Key files:** `lib/receipts.ts`, `app/receipt/[token]/page.tsx`, `app/api/receipt/[token]/pay/route.ts`, `middleware.ts`

### Feature 6 — Refunds

**Status: COMPLETE**

- `lib/refunds/refund-service.ts`: refund creation with idempotency keys, amount caps (≤ order vendor earnings), wallet vs original-payment-method rules, status transitions (PENDING→APPROVED/REJECTED→PROCESSED/FAILED).
- `app/api/vendor/orders/[orderId]/refunds/route.ts` (vendor refund request) + `app/api/admin/refunds/...` (admin approval).
- `lib/webhooks/refund-webhook-handler.ts`: Paystack refund webhook with signature verification, marks refund PROCESSED/FAILED.
- `Refund`, `ReturnRequest`, `VendorPayout` models on schema.

**Bugs/gaps:** None blocking.

**Key files:** `lib/refunds/refund-service.ts`, `lib/webhooks/refund-webhook-handler.ts`, `app/api/vendor/orders/[orderId]/refunds/route.ts`

### Feature 7 — Stock management / overselling protection

**Status: PARTIAL**

- `lib/stock-reservation.ts`: `reserveStock` (reserves quantity per product/variant, `SELECT ... FOR UPDATE`, TTL) and `consumeInventory` (decrements stock, releases reservation).
- Used by checkout (online orders) and manual-orders create (409 with product list on insufficient stock).
- `Product.reservedQuantity` + `ProductVariant.reservedQuantity` fields on schema.
- Cron `app/api/cron/release-expired-reservations/route.ts` releases expired reservations.

**Bugs/gaps:** `reserveStock` loops per item acquiring row locks sequentially → lock contention / slow under high concurrency (carried from prior audit M1). No async reservation-release SLA beyond the cron. Partial because the mechanism exists but has a scalability risk.

**Key files:** `lib/stock-reservation.ts`, `app/api/cron/release-expired-reservations/route.ts`, `prisma/schema.prisma` (Product.reservedQuantity)

### Feature 8 — Low-stock alerts

**Status: PARTIAL**

- `lib/low-stock-alerts.ts`: evaluates products below threshold, creates `LowStockAlert` records.
- `app/api/cron/low-stock-alerts/route.ts`: runs the alert cron.
- `NOTIFICATION_TEMPLATES` in `lib/notifications.ts` declares channels `['EMAIL', 'SMS', 'IN_APP']` for some templates, but `createNotification` only writes an in-app `Notification` record — no real email/SMS dispatch.
- No SMS provider integrated (Twilio/Africas Talking references only in docs/seed text, no lib integration).

**Bugs/gaps:** Alerts are in-app only despite SMS/EMAIL channel declarations. No Twilio/Africas Talking integration → SMS channel is a stub. Partial.

**Key files:** `lib/low-stock-alerts.ts`, `lib/notifications.ts`, `app/api/cron/low-stock-alerts/route.ts`

### Feature 9 — Daily sales summary / revenue reporting

**Status: COMPLETE**

- `lib/sales-summary.ts`: pure module computing revenue/COGS/profit/receivables by source (ONLINE/MANUAL) and channel (WhatsApp/IG/FB/Call/Walk-in/Other/Marketplace), Africa/Accra day boundaries, integer pesewas, cost-coverage flags, estimated-profit labeling for ONLINE orders (current cost, no snapshot).
- `app/api/vendor/sales-summary/route.ts` + `/export` CSV endpoint.
- `app/dashboard/vendor/sales/page.client.tsx`: period picker (30d/90d/1y/custom/custom), totals cards (revenue/profit/COGS/unpaid), source split, missing-cost nudge, CSV export, mark-as-paid for manual orders, WhatsApp reminder links.
- Cron `app/api/cron/daily-sales-summary/route.ts` + `lib/daily-summary.ts`: writes `DailySummary`, in-app + email notification only.

**Bugs/gaps:** Daily summary notification is in-app + email (Brevo) only; no SMS. Email mock-falls-back when no Brevo key. Otherwise complete.

**Key files:** `lib/sales-summary.ts`, `lib/daily-summary.ts`, `app/api/vendor/sales-summary/route.ts`, `app/dashboard/vendor/sales/page.client.tsx`

---

## C. Cross-Cutting Gaps

| Area | Finding | Severity |
|------|---------|----------|
| Auth/session | Auth errors swallowed in `server-entry.js` (carried H2); middleware passes `token` cookie through for `/api/*`; JWT + Session table auth. | Medium |
| Build safety | `typescript.ignoreBuildErrors` + `eslint ignoreDuringBuilds` disabled (carried H1) — type/lint errors won't fail deploys. | High |
| Secrets | `.env` contains hardcoded `SUPER_ADMIN_PASSWORD`, Cloudinary keys, Paystack `sk_test` keys. | High (security) |
| SMS | SMS channel declared in notification templates but no provider (Twilio/Africas Talking) integrated. | Medium |
| Pay links | `PAYLINK_ENABLED` defaults `false`; pay-link flow returns 503 until enabled. | High (feature) |
| Stock reservation | Per-item `SELECT ... FOR UPDATE` loop → contention under load. | Medium |
| Email | Brevo integration present but mock-falls-back when no API key; delivery not guaranteed in dev/staging. | Low |

---

## D. Security Concerns

1. **Hardcoded secrets in `.env`**: `SUPER_ADMIN_PASSWORD`, Cloudinary `API_SECRET`, Paystack `sk_test_*` secret keys are committed to the environment file. Rotate all and move to a secret manager (Railway variables / Vault). P0.
2. **Paystack test keys**: `sk_test` keys indicate test-mode credentials; ensure production uses live keys and never logs full webhook payloads containing card metadata.
3. **Public receipt-by-token**: receipt pages are unauthenticated and rate-limited (60/min/IP) — acceptable, but ensure `receiptToken` is unguessable (crypto.randomUUID) and not enumerable. Verified: tokens generated server-side.
4. **Auth error swallowing**: `server-entry.js` catches and swallows auth errors (H2) — could mask failed authn/authz in logs. Review error handling.
5. **Build safety off**: type/lint errors don't block deploys → risk of shipping broken auth/ACL. Re-enable.

---

## E. Prioritized To-Do List

### P0 (do first)
1. **Rotate hardcoded secrets** (`.env`): `SUPER_ADMIN_PASSWORD`, Cloudinary secret, Paystack keys. Move to Railway secret vars. *(~.env + deploy config)*
2. **Enable pay links by default** (or document required flag): set `PAYLINK_ENABLED=true` in production env; verify pay-link create → WhatsApp share → pay-now flow end-to-end. *(`.env`, `app/api/vendor/manual-orders/[orderId]/pay-link/route.ts`)*
3. **Re-enable build safety**: remove `typescript.ignoreBuildErrors` and `eslint ignoreDuringBuilds`; fix resulting type/lint errors. *(`next.config.js` / `next.config.mjs`)*

### P1
4. **Integrate SMS provider** (Twilio or Africas Talking) for low-stock + order notifications; wire `NOTIFICATION_TEMPLATES` SMS channel to real dispatch. *(`lib/notifications.ts`, new `lib/sms.ts`)*
5. **Fix stock-reservation contention**: batch `SELECT ... FOR UPDATE` or use advisory locks / single transaction; add reservation TTL monitoring. *(`lib/stock-reservation.ts`)*
6. **Verify webhook signature verification** on both order and refund webhooks is enforced in all environments (not bypassed in dev). *(`lib/webhooks/*`)*
7. **Add tests** for pay-link 503 path, manual-order status transitions, stock-reservation concurrency. *(`.test.ts` files)*

### P2
8. **SMS/WhatsApp order status notifications** for fulfillment changes (FULFILLMENT_STATUS_UPDATED template declares SMS). *(`lib/notifications.ts`)*
9. **Email delivery reliability**: ensure Brevo key configured in prod; add fallback alert when email fails. *(`lib/email.ts`)*
10. **Low-stock alert dashboard UI**: surface `LowStockAlert` records in vendor dashboard (currently cron + DB only). *(`app/dashboard/vendor/...`)*

### Effort estimates
- P0 items: 1–2 days total (mostly config + env).
- P1 items: 3–5 days (SMS integration is the largest).
- P2 items: 2–3 days.

---

## F. Open Questions

1. What is the intended default for `PAYLINK_ENABLED` in production — should it be `true` by default with an opt-out, or remain opt-in?
2. Which SMS provider is preferred for Ghana (Africas Talking vs Twilio) and are credentials available?
3. Are Paystack live keys configured for production, or are `sk_test` keys still in use?
4. Is there an existing secret-management process (Railway variables, external vault) to rotate the `.env` secrets?
5. What is the expected concurrent order volume that would make stock-reservation contention a real problem (to size the P1 fix)?

---

## Appendix: Files Referenced

- `prisma/schema.prisma` — Order, OrderItem, Product, VendorCustomer, Refund, ReturnRequest, VendorPayout, DailySummary, LowStockAlert models
- `app/api/checkout/route.ts` — online checkout + Paystack init + stock reservation
- `app/api/vendor/manual-orders/route.ts` — manual order creation
- `app/api/vendor/manual-orders/[orderId]/pay-link/route.ts` — pay-link creation (flag-gated)
- `app/api/vendor/orders/route.ts` + `[orderId]/route.ts` — vendor order inbox + transitions
- `app/api/receipt/[token]/pay/route.ts` — public pay-now by receipt token
- `lib/webhooks/order-webhook-handler.ts` — Paystack order webhook (signature verified)
- `lib/webhooks/refund-webhook-handler.ts` — Paystack refund webhook (signature verified)
- `lib/refunds/refund-service.ts` — refund service (idempotency, caps, wallet rules)
- `lib/stock-reservation.ts` — reserve/consume inventory with `FOR UPDATE`
- `lib/sales-summary.ts` — revenue/COGS/profit pure module (Africa/Accra, pesewas)
- `lib/daily-summary.ts` + `app/api/cron/daily-sales-summary/route.ts` — daily summary cron
- `lib/low-stock-alerts.ts` + `app/api/cron/low-stock-alerts/route.ts` — low-stock cron
- `lib/receipts.ts` — receipt data building (store contact WhatsApp/phone fallback)
- `lib/notifications.ts` — in-app notifications + template channels (EMAIL/SMS/IN_APP)
- `lib/phone.ts` — `getWhatsAppLink` (wa.me generator)
- `lib/manual-orders.ts` — `buildWhatsAppShareLink`
- `lib/email.ts` — Brevo email with mock fallback
- `middleware.ts` — JWT/Session auth, ACL on `/dashboard/*`, receipt rate limiting
- `app/dashboard/vendor/quick-sale/page.[client].tsx` — quick-sale UI + pay-link WhatsApp share
- `app/dashboard/vendor/orders/page.[client].tsx` — order inbox UI + manual transitions
- `app/dashboard/vendor/customers/page.[client].tsx` — customer directory
- `app/dashboard/vendor/sales/page.[client].tsx` — sales reporting + CSV export
- `app/receipt/[token]/page.tsx` + `PrintButton.tsx` + `PayNowButton.tsx` — receipt UI
