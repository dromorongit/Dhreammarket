# Low-stock alerts & reorder reminders — step 1 plan

## How "low stock" is defined
- `Product.lowStockThreshold` (Int, default 5): `prisma/schema.prisma:274`. Set on vendor edit form: `app/dashboard/vendor/products/[id]/edit/page.client.tsx:276,460-468`.
- Uses **available stock** = `stock - reservedQuantity` vs threshold: `lib/demand-forecast.ts:79-80,114,135`; store-level filter `availableStock <= threshold && availableStock > 0` at `lib/demand-forecast.ts:247-250` (out of stock `=== 0` at :259).
- `app/api/vendor/metrics/route.ts:263-269` hard-codes threshold `5`, ignoring per-product `lowStockThreshold` (**unverified** if intentional).
- **Variants have no threshold**: `ProductVariant` (`prisma/schema.prisma:387-406`) has `stock`/`reservedQuantity` but no `lowStockThreshold`. Variant-level low stock **unverified**.

## Stock-reducing code paths (where the check fires)
- `consumeInventory(orderId)` — `lib/stock-reservation.ts:409`, called from `app/api/vendor/orders/[orderId]/route.ts:536` and `app/api/admin/orders/[id]/route.ts:260`.
- `consumeManualSaleStock(...)` — `lib/stock-reservation.ts:618`, called from `app/api/vendor/manual-orders/route.ts:390`.
- Restock receipts **increase** stock: `lib/restock-procurement.ts:165-170` (status `RECEIVED` → `stock: { increment }`).
- Direct vendor stock edits: `app/api/products/[id]/route.ts`.

Call a "just crossed below threshold" helper at the end of `consumeInventory`/`consumeManualSaleStock` (inside transaction, compare previous vs new `availableStock` vs `lowStockThreshold`). On restock (increment), clear alert state if recovered above threshold.

## Vendor notification mechanics
- `createNotification(userId, type, title, message)` — `lib/notifications.ts:101` (in-app `Notification`).
- `shouldSendNotification` → `getVendorNotificationPreferences` reads `vendorSettings.notifyLowStock` (`lib/notification-preferences.ts:16-26`; schema default true: `prisma/schema.prisma:863`).
- `shouldNotifyVendor` maps `RESTOCK_ORDER_OVERDUE` → `notifyLowStock` (`lib/notification-preferences.ts:93-94`). No `LOW_STOCK` `NotificationType` exists (`prisma/schema.prisma:2751-2780`); closest is `SYSTEM_ALERT` (**unverified** fit).
- Email via `sendEmail` → Brevo SMTP: `lib/email.ts:57,76`. FailedEmail retry queue: `lib/email.ts:22-125`.
- No dedup evident (`createNotification` writes per call). Vendor can mute via `notifyLowStock`; `notificationChannels` JSON exists (`prisma/schema.prisma:866`) but unused for gating (**unverified**).

## Design: event-driven vs scheduled digest
(a) Event-driven: fire at crossing time in `consumeInventory`/`consumeManualSaleStock`. Needs state to avoid repeats: add `lowStockAlertedAt DateTime?` to `Product`, set on alert, cleared when `availableStock > threshold`.
(b) Scheduled digest: query all low-stock products periodically, send one digest. Slower; re-alerts unless state tracked.

**Recommendation:** hybrid — event-driven in-app alert + optional email at crossing time (smallest change), plus `lowStockAlertedAt` for dedup. Scheduled digest deferred to step 2.

## Reorder reminders / supplier data
- `Product` has no `supplierId` (`prisma/schema.prisma:264-318`); supplier links indirectly via `Supplier.vendorId` (`:1113`) and `PurchaseOrder`/`PurchaseOrderItem.productId` → `Product` (`:1139-1178`). Preferred supplier per product **unverified**.
- `RestockOrder` links to `Product` + optional `PurchaseOrder` (`:1078-1099`); `createRestockOrder(productId, vendorId, quantityOrdered, expectedArrivalDate, notes)`: `lib/restock-procurement.ts:7-13`. No supplier on RestockOrder (**unverified**).
- Suggested quantity: `getProductDemandMetrics.recommendedRestock` (`lib/demand-forecast.ts:126`) or `recommendedQuantity` in `getVendorDemandAnalytics` (`:282-294`).

## Where the seller sees low stock today
- Metrics API computes low-stock products: `app/api/vendor/metrics/route.ts:256-269`.
- No dedicated low-stock list/badge found in vendor dashboard (**unverified**). Natural placement: dashboard overview header badge + "Low stock" tab/list on vendor products page (`app/dashboard/vendor/products/page.client.tsx`), with a "Reorder" button per item → `createRestockOrder`.

## Smallest proposed change
1. **Schema**: add `lowStockAlertedAt DateTime?` to `Product` (`prisma/schema.prisma:264-318`); add `LOW_STOCK` to `NotificationType` (`:2751-2780`).
2. **Check**: in `consumeInventory`/`consumeManualSaleStock` (`lib/stock-reservation.ts`), after decrement, if `availableStock <= lowStockThreshold && > 0 && lowStockAlertedAt === null`, set `lowStockAlertedAt = now()` and fire alert. On restock increment (`lib/restock-procurement.ts:165-170`), clear `lowStockAlertedAt` if recovered above threshold.
3. **Alert**: `createNotification(vendorId, 'LOW_STOCK', title, message)` gated by `vendorSettings.notifyLowStock`; optional email via `sendEmail` (`lib/email.ts`) if channel enabled (**unverified** gating).
4. **Dashboard**: low-stock badge/count + "Reorder" button per low-stock product calling `createRestockOrder` with `recommendedRestock` as `quantityOrdered`.

## Risks
- Race: concurrent consumptions could double-fire; mitigated by null-check inside transaction (**unverified** isolation).
- Variant-level alerts unsupported (no variant threshold) — product-level only.
- Threshold inconsistency: metrics route hard-codes `5` vs per-product field (`app/api/vendor/metrics/route.ts:264`).
- Email failures → FailedEmail retry queue; keep low-stock email retriable, non-blocking.

## Files to change
- `prisma/schema.prisma` (Product.lowStockAlertedAt; NotificationType.LOW_STOCK)
- `lib/stock-reservation.ts` (consumeInventory, consumeManualSaleStock)
- `lib/restock-procurement.ts` (restock recovery clear)
- `lib/email.ts` (optional vendor low-stock email helper)
- `app/dashboard/vendor/products/page.client.tsx` (+ overview) — badge/list + Reorder action
