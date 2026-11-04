# Seller Commerce OS gap analysis — Dhream Market

Read-only audit. No source files modified. Claims cite file paths; anything not confirmed in code is marked `unverified`.

## Scope

A small seller runs orders from WhatsApp, Instagram, calls and mobile money and must manage everything inside Dhream Market. Audited against the `prisma/schema.prisma` data model, `app/api/vendor/*` routes, `lib/*` modules, and the vendor dashboard pages.

## Capability-by-capability findings

### 1. Product catalogue and stock management

Status: complete

Evidence:
- `Product` model with `stock`, `reservedQuantity`, `lowStockThreshold` — prisma/schema.prisma:264-318
- `ProductVariant` with per-variant `stock` — prisma/schema.prisma:387-406
- Stock allocation/reservation engines — lib/stock-allocation-engine.ts, lib/stock-reservation.ts
- Manual orders consume stock via `consumeManualSaleStock` — app/api/vendor/manual-orders/route.ts:390-408

What is missing to reach the goal: none for catalogue/stock itself.

Effort: —

Dependencies: none

---

### 2. Unified order inbox mixing Dhream orders and off-platform orders

Status: partial

Evidence:
- `Order.source` is `OrderSource` enum `ONLINE | MANUAL` — prisma/schema.prisma:3250-3253
- `Order.channel` is `SaleChannel` enum `WHATSAPP | INSTAGRAM | FACEBOOK | CALL | WALK_IN | OTHER` — prisma/schema.prisma:3255-3262
- Manual orders are written with `source: 'MANUAL'` and the chosen channel — app/api/vendor/manual-orders/route.ts:333-334
- Vendor orders page reads `source` and `channel` per order and badges them — app/dashboard/vendor/orders/page.client.tsx:48-80, 800+ (SOURCE_BADGE)

Correction to the capability wording: `Order.source` records `ONLINE` vs `MANUAL`, not the channel. The channel (WhatsApp, Instagram, call, in-person) lives in `Order.channel`.

What is missing to reach the goal: a single inbox endpoint/UI that explicitly merges online and manual orders with source/channel filtering and unpaid-first sorting is not confirmed in code. The orders page shows both sources but a dedicated unified-inbox view/filter was not verified.

Effort: M

Dependencies: none (schema already supports it)

---

### 3. Payment links a seller can send to WhatsApp/Instagram customers, incl. pay-status tracking for unpaid orders

Status: partial (pay-link missing; receivable tracking present)

Evidence:
- Paystack integration for online checkout — lib/paystack.ts, `Payment` model — prisma/schema.prisma:594-611
- Manual orders can be created `markPaid: false` (unpaid) and confirmed later by the vendor — app/api/vendor/manual-orders/route.ts:337, app/api/vendor/manual-orders/[orderId]/confirm-payment/route.ts
- Unpaid manual orders are surfaced as receivables — lib/sales-summary.ts:656-665 (`isReceivable`), app/api/vendor/sales-summary/route.ts:128-131 (`loadVendorReceivables`)
- Receipt token/URL generated on every manual order — app/api/vendor/manual-orders/route.ts:288, lib/receipts.ts

What is missing to reach the goal:
- No Paystack payment-link (initialize) generation for a manual order. The receipt URL is a receipt, not a pay link, so a seller cannot send a customer a link to pay online.
- No webhook/pay-status tracking for manual orders (the Paystack webhook only handles `Payment`-linked online orders — lib/webhooks/order-webhook-handler.ts:29-322). Unpaid manual orders stay `PENDING` until the vendor manually confirms via confirm-payment.
- `unverified`: no pay-link route was found anywhere in `app/api`.

Effort: M

Dependencies: Paystack secret key (`PAYSTACK_SECRET_KEY`, already used by lib/paystack.ts:2); new route + webhook handling for manual-order payments.

---

### 4. Order status updates and delivery booking (courier integration, delivery fee on the order)

Status: partial (status updates complete; courier booking missing)

Evidence:
- Manual-order status graph `PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED`, plus `CANCELLED` — app/api/vendor/manual-orders/[orderId]/status/route.ts:16-23
- Order statuses `PENDING/PROCESSING/SHIPPED/DELIVERED/COMPLETED/CANCELLED` — prisma/schema.prisma:2731-2738
- Delivery fee charged to customer: `Order.shipping` — prisma/schema.prisma:519
- What the vendor paid the rider: `Order.deliveryCost` — prisma/schema.prisma:520, settable via app/api/vendor/manual-orders/[orderId]/route.ts
- Item-level `shippedAt`/`deliveredAt` stamping — lib/order-delivery-stamps.ts

What is missing to reach the goal: no courier integration or delivery-booking provider found. The vendor enters `deliveryCost` manually; there is no third-party courier API.

Effort: S (status/delivery fee already done); L (courier integration — new provider required)

Dependencies: courier API account (e.g. GIG, Sendy, DHL local) — unverified which, if any, is configured.

---

### 5. Digital receipts (generation, sharing by link/PDF/WhatsApp)

Status: complete (server-generated PDF missing)

Evidence:
- `Order.receiptToken` unique token — prisma/schema.prisma:536
- Receipt generation DTO — lib/receipts.ts:42-127
- Public receipt page — app/receipt/[token]/page.tsx
- Print / Save PDF via browser `window.print()` — app/receipt/[token]/page.tsx:184-195
- WhatsApp share link `wa.me/<digits>?text=<receipt URL>` — lib/manual-orders.ts:185-190 (`buildWhatsAppShareLink`)
- Quick-sale UI sends receipt on WhatsApp / copies link — app/dashboard/vendor/quick-sale/page.client.tsx:395-404

What is missing to reach the goal: no server-generated PDF (print-only). Sharing by link and WhatsApp wa.me link is present.

Effort: S (add a PDF library if server PDF desired)

Dependencies: none

---

### 6. Sales, fees, refunds and payout reporting, including profit after delivery costs

Status: complete

Evidence:
- Sales summary with revenue, COGS, delivery cost, profit `revenue - cogs - deliveryCost` — lib/sales-summary.ts:864-895 (`accumulatorTotals`)
- Profit labelled "Profit before other expenses" — lib/sales-summary.ts:34
- Vendor sales summary API — app/api/vendor/sales-summary/route.ts
- CSV export — app/api/vendor/sales-summary/export/route.ts
- Refunds: `Refund` model — prisma/schema.prisma:2559-2596; `lib/refunds/`, `lib/paystack-refunds.test.ts`
- Payouts: `VendorPayout`, `VendorPayoutMethod` (`MOBILE_MONEY`/`BANK_ACCOUNT`) — prisma/schema.prisma:680-715; app/api/vendor/payouts/route.ts
- `PlatformPolicy.payoutMode` defaults to `REPORT_ONLY` — prisma/schema.prisma:2550, lib/delivery.ts:45

What is missing to reach the goal: none for reporting.

Effort: —

Dependencies: none (payout execution is report-only by default; switch to `AUTOMATIC`/`MANUAL` if payout disbursement is wanted)

---

### 7. Customer records and repeat-order tools (reorder, order history per customer)

Status: partial

Evidence:
- `VendorCustomer` model: `name`, `phone` (unique per store), `email`, `firstChannel`, `tags`, `notes`, `orders` relation — prisma/schema.prisma:202-219
- Customer upsert on manual order by phone — app/api/vendor/manual-orders/route.ts:313-326
- Customers API list/lookup — app/api/vendor/customers/route.ts, app/api/vendor/customers/lookup/route.ts
- Customer order history via `VendorCustomer.orders` — prisma/schema.prisma:214

What is missing to reach the goal: no reorder tool (recreate an order from a customer's past order) confirmed in code. `unverified`: no reorder endpoint found.

Effort: M

Dependencies: none

---

### 8. Low-stock alerts and reorder reminders (automatic, not just a restock page)

Status: partial

Evidence:
- `Product.lowStockThreshold` (default 5) — prisma/schema.prisma:274
- Low-stock computation — lib/demand-forecast.ts:243-282 (`lowStockProducts`, status `low_stock`)
- Restock orders with status flow and overdue detection — lib/restock-procurement.ts (`createRestockOrder`, `checkOverdueRestockOrders`), prisma/schema.prisma:1075-1096
- Overdue restock sends an in-app notification — lib/restock-procurement.ts:267-292

What is missing to reach the goal: no automatic low-stock alert mechanism confirmed. `checkOverdueRestockOrders` exists but no scheduler/cron invocation was found (no vercel.json, no cron route for low-stock). Restock order creation is manual; there is no automatic reorder reminder when `stock <= lowStockThreshold`.

Effort: M

Dependencies: scheduler (cron route pattern exists at app/api/cron/ — influencer-trial-expiry route shows the pattern) — third-party alert channel not needed if in-app/email used.

---

### 9. Daily sales summary via dashboard, WhatsApp or SMS

Status: partial (dashboard yes; WhatsApp/SMS no)

Evidence:
- Sales summary API + dashboard — app/api/vendor/sales-summary/route.ts, app/dashboard/vendor/sales/
- Daily breakdown in summary — lib/sales-summary.ts:559-570 (`SalesDailyRow`)
- Notifications module supports `EMAIL | SMS | IN_APP` channels in templates — lib/notifications.ts:13-14, but `createNotification` only writes to the `Notification` table (in-app) — lib/notifications.ts:101-122. No SMS/WhatsApp sending provider found.
- No scheduled daily digest; cron pattern exists but no daily-sales cron route — app/api/cron/influencer-trial-expiry/route.ts shows the cron route pattern.

What is missing to reach the goal: WhatsApp/SMS delivery channel and a scheduled daily summary job.

Effort: M-L

Dependencies: SMS gateway or WhatsApp Business API account; cron scheduler (Vercel Cron or external).

---

## Recommended build order

Smallest slice that lets a seller handle a WhatsApp order end to end (create order, send pay link, get paid, send receipt, mark dispatched):

1. **Create the WhatsApp order** — already works: `POST /api/vendor/manual-orders` with `channel: "WHATSAPP"`, customer phone/name, items, delivery fee. Returns `receiptToken` and `receiptUrl`. (app/api/vendor/manual-orders/route.ts, app/dashboard/vendor/quick-sale/page.client.tsx)
2. **Send a pay link** — GAP. Add a route `POST /api/vendor/manual-orders/[orderId]/pay-link` that initializes a Paystack transaction for the order total, stores the reference on the order/Payment, and returns `authorization_url` to send to the customer. Requires `PAYSTACK_SECRET_KEY`. Until built, the seller must mark the order paid manually (confirm-payment route).
3. **Get paid** — customer pays via the Paystack link; webhook marks the order `PAID`. Until the pay-link/webhook is built, seller confirms payment via `PATCH /api/vendor/manual-orders/[orderId]/confirm-payment` with `paymentMethod` (Mobile Money/Cash).
4. **Send receipt** — already works: share `receiptUrl` via WhatsApp using `buildWhatsAppShareLink` or copy link. (lib/manual-orders.ts:185-190, quick-sale page)
5. **Mark dispatched** — `PATCH /api/vendor/manual-orders/[orderId]/status` with `status: "SHIPPED"`, then `DELIVERED`, then `COMPLETED`. Set `deliveryCost` via `PATCH /api/vendor/manual-orders/[orderId]`.

This slice needs no schema changes; it reuses `Order.source='MANUAL'`, `Order.channel`, `receiptToken`, and the existing status/delivery-cost routes. The only new code is the pay-link route + Paystack webhook handling for manual orders.

Effort for the slice: M.