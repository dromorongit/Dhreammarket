# M6 Plan: Stock Reservation Around Checkout

## Current behavior (read-only audit)

**Stock validation (checkout)** — `app/api/checkout/route.ts:93-108` validates stock (`availableStock < item.quantity` per item, variant takes precedence) but does NOT reserve anything. After Paystack initialization (`route.ts:367-389`), the flow updates `payment.paystackRef` (383-386), sends confirmation email (392-400), creates notifications (403-423), records fulfillment events (426-436), and returns. No `reserveStock` call exists in checkout.

**Reservation functions** — `lib/stock-reservation.ts`:
- `reserveStock` (line 25): increments `reservedQuantity` on product/variant inside `SELECT ... FOR UPDATE`; skips non-IN_STOCK; no expiry recorded.
- `releaseStock` (line 131): decrements `reservedQuantity` from an order's items; exists but is only invoked reactively (verify failure, webhook failure, cancel, refund, admin cleanup).
- `consumeInventory` (line 369): decrements real `stock` + `reservedQuantity` at fulfillment; sets `order.inventoryConsumedAt`.

**Expiry** — `reservedQuantity` is a plain `Int @default(0)` counter on `Product` (`schema.prisma:273`) and `ProductVariant` (`schema.prisma:396`). No `reservedAt`/`expiresAt` column exists on either table (unverified: no reservation-expiry column anywhere in schema). No cron/job releases expired reservations. `app/api/cron/` contains only `influencer-trial-expiry/route.ts` (verified). The only release path for unpaid orders is the manual admin endpoint `app/api/admin/orders/cleanup-stale/route.ts:17-37` (24-hour stale PENDING orders).

**Where reserve/release is called in payment flows:**
- `app/api/payment/verify/route.ts:303` calls `reserveStock` (NORMAL orders only) after payment marked PAID; `route.ts:169` calls `releaseStock` on failure/abandoned/cancelled.
- `lib/webhooks/order-webhook-handler.ts:257` calls `reserveStock`; `order-webhook-handler.ts:127` calls `releaseStock` on failure.
- Webhook routing: `app/api/webhook/paystack/route.ts:174` routes `DHV-` refs to `handleOrderWebhook`.

**Double reservation risk:** If checkout reserves stock and `verify`/webhook later calls `reserveStock` again for the same order, `reservedQuantity` would be incremented twice (2x quantity) because neither side checks whether stock is already reserved for that order. The idempotency guard at `verify/route.ts:122` only skips re-processing once `payment.status === 'PAID'`; a partial/failure path between the two reserve calls could double-reserve.

**Failed/cancelled/never-pays:** verify and webhook mark payment FAILED/CANCELLED and call `releaseStock` for NORMAL orders (verify:162-172; webhook:122-130). If a customer never pays, the order stays PENDING and stock is currently NOT held (checkout only validates). With checkout-side reservation added, abandoned orders would hold stock until the manual `cleanup-stale` endpoint runs — no automatic expiry exists.

## Proposed smallest safe change

1. **Add reservation expiry column** (schema migration): add `reservedAt DateTime?` to `Product` and `ProductVariant` (or a single `reservationExpiresAt` on the order). Suggested TTL: 15–30 min.
2. **`app/api/checkout/route.ts`:** after order/payment creation and before Paystack init, call `reserveStock(orderId, items)`; on Paystack failure (`catch` at 453-475), call `releaseStock(orderId)`. Skip when `fullyCoveredByWallet` (no payment needed).
3. **`app/api/payment/verify/route.ts` and `lib/webhooks/order-webhook-handler.ts`:** before calling `reserveStock`, skip if an active reservation already exists for this order (e.g. check `reservedAt` is set / a reservation marker), or make `reserveStock` idempotent per order.
4. **New cron job** `app/api/cron/release-expired-reservations/route.ts`: release `reservedQuantity` for PENDING orders older than TTL (reuse `releaseStock`), then mark them CANCELLED/FAILED.
5. **Risks:** race between checkout reserve and verify reserve (double-reserve) mitigated by idempotency check; long DB locks from `FOR UPDATE` in `reserveStock`; release on expiry could free stock that was legitimately consumed if `consumeInventory` runs concurrently (guard: skip orders with `inventoryConsumedAt` set); cron must be idempotent (re-runs safe).
