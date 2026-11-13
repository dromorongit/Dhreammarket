# Pay-link plan (read-only audit)

Line numbers from working tree; `unverified` = not confirmed by tests.

## Answers

**1. Manual order → Payment record?** No. `app/api/vendor/manual-orders/route.ts:330-367` creates the `Order` but never calls `prisma.payment.create`; `grossAmount`, `processorFee`, `netAmount`, `platformCommission`, `vendorEarnings`, `commissionRate` are `null` (route.ts:350-355). `confirm-payment` (`app/api/vendor/manual-orders/[orderId]/confirm-payment/route.ts:127-150`) only updates the `Order` plus an audit log — no `Payment` row, no commission.

**2. Paystack init and webhook routing.** Checkout (`app/api/checkout/route.ts:202`) builds `reference = DHV-${crypto.randomBytes(8).toString('hex').toUpperCase()}`, callback `${SITE_URL}/checkout` (line 389), metadata `{ orderId, userId, vendorBreakdown, walletAmountApplied }` (lines 403-408), creates a `Payment` row with that reference (line 298). The webhook dispatcher (`app/api/webhook/paystack/route.ts:174-182`) routes by first 4 chars of `data.reference`: `DHV-` → `handleOrderWebhook`, `VER-` → `handleVerificationWebhook`, `SUB-` → `handleSubscriptionWebhook`, `ADV-` → `handleAdvertisingWebhook`; anything else acknowledged unhandled (line 186). `handleOrderWebhook` looks up `Payment` by `reference` (`lib/webhooks/order-webhook-handler.ts:46-51`), so a manual order (no `Payment` row) hits `404 Payment not found` and cannot safely reach it.

**3. `handleOrderWebhook` assumptions that break/double-apply for a MANUAL order whose stock was already consumed** (`lib/webhooks/order-webhook-handler.ts`):
- Line 46-51: requires a `Payment` row — manual orders have none → 404.
- Line 64-66 `checkPaystackAmount(..., payment)`: `payment.amount` undefined for manual orders.
- Line 358-371 `reserveStock(...)`: re-reserves stock already consumed at creation (manual-orders/route.ts:390-408) → double-decrement.
- Line 408-415 cart clearing: `payment.userId` is `null` (route.ts:332) — no-op.
- Line 382-402 wallet debit: assumes wallet-paid online flow.
- Line 189-192 late-payment: requires `CANCELLED` + `FAILED` + `reservationExpiredAt` — manual orders are `PROCESSING`/`PENDING`.
- Line 304-349: recomputes commission/earnings per item — would overwrite manual snapshot pricing (`unverified`).

**4. Stock and commission today; cancelling an unpaid manual order.** Stock consumed at creation via `consumeManualSaleStock` (manual-orders/route.ts:390-408; `lib/stock-reservation.ts:618-720`), setting `Order.inventoryConsumedAt` (line 697-700). Commission stays `null`; `confirm-payment` does not backfill it (`unverified`). Cancellation calls `restoreManualSaleStock` (`lib/stock-reservation.ts:727-823`) — idempotent, no-op if `inventoryConsumedAt` is null, otherwise restores stock. Called from vendor/super-admin/admin cancel routes (`unverified` full list).

**5/6. Landing page.** `app/receipt/[token]/page.tsx` is public (no `verifyToken`; only `getReceiptByToken`, line 50), shows status Paid/Unpaid, items, totals, print button. Every manual order already gets a `receiptToken` (route.ts:288) and `buildReceiptUrl` (`lib/manual-orders.ts:178`). **`app/receipt/[token]` is a suitable pay-link landing page; no login required.** Checkout callback `${SITE_URL}/checkout` auth unconfirmed (`unverified`).

## Smallest safe design

**New route:** `POST /api/vendor/manual-orders/[orderId]/pay-link` (vendor-authed, onboarded). Idempotent: if `paymentStatus === 'PAID'`, return existing receipt URL. Otherwise create a `Payment` row (`orderId`, `amount = order.total`, `currency = 'GHS'`, `status = 'PENDING'`, `reference = MAN-${crypto.randomBytes(8).toString('hex').toUpperCase()}` — new prefix, not `DHV-`; `unverified` schema allows `userId: null` — check `prisma/schema.prisma:594-611`). Call `initializePaystackPayment(email, order.total, reference, ${SITE_URL}/receipt/[receiptToken], { orderId, source: 'MANUAL', vendorId: store.id })` (`lib/paystack.ts:104`), set `Payment.paystackRef`, return `{ authorizationUrl, reference, receiptUrl }`.

**Webhook:** add `MAN-` branch in `app/api/webhook/paystack/route.ts:174-182` → new `lib/webhooks/manual-order-webhook-handler.ts`. Verify signature, look up `Payment` by reference, idempotent on `payment.status === 'PAID'`, validate amount via `checkPaystackAmount` (`lib/payment-checks.ts:26`), then in one transaction set `payment.status = 'PAID'`, `order.paymentStatus = 'PAID'`, `order.paymentConfirmedAt`, `order.status = 'PROCESSING'`, `PAYMENT_CONFIRMED` audit log, customer notification (`unverified` for `userId: null`), `invalidateSalesSummaryCache(store.id)`. **No `reserveStock`/`releaseStock`, no cart clearing, no per-item commission recompute** — stock already consumed at creation.

**Double-confirm protection:** `confirm-payment` returns early when already `PAID` (route.ts:101-115); manual webhook does the same. `MAN-` never reaches `handleOrderWebhook`, so online side effects cannot apply to manual orders. Both idempotent on PAID (`unverified` race between webhook and confirm-payment).

**Files to change:** new `app/api/vendor/manual-orders/[orderId]/pay-link/route.ts`; new `lib/webhooks/manual-order-webhook-handler.ts`; edit `app/api/webhook/paystack/route.ts` (add `MAN-` branch). Reuse unchanged: `lib/paystack.ts`, `lib/payment-checks.ts`, `app/receipt/[token]/page.tsx`, `lib/stock-reservation.ts` (`restoreManualSaleStock`).

**Risks:** `userId: null` means notifications/emails keyed on `userId` are no-ops (`unverified`). Commission/earnings never computed for manual orders — webhook should not introduce this without a decision. `MAN-` prefix collision (`unverified` none exist). Same `PAYSTACK_SECRET_KEY` as online (`unverified`). `TOLERANCE_GHS = 0.01` (`lib/payment-checks.ts:12`) fine for manual totals.
