# Trust Phase 2 Design

## Findings

### trust-metrics.ts exports
- `countAttributableVendorCancelledOrders(orders, orderItems, products, storeId): number`
- `vendorRejectedOrdersWhere(storeId)` Prisma where clause.
Rules: vendor rejection (vendorRejected true), paymentStatus PAID or REFUNDED, ONLINE source, all items belong to store (multi-store excluded).

### Verification fields
- `Store.isVerified` boolean (admin-controlled, vendor cannot edit).
- `VendorVerificationApplication.status` (VerificationStatus enum), APPROVED means verified.
- `VendorVerificationApplication.updatedAt` used as verifiedSince.
- Vendors cannot set verification fields; only admin approval changes status.

### Delivered-at and promised date
- `OrderItem.deliveredAt` (DateTime?) records delivery.
- `OrderItem.deliveryConfirmedAt`, `deliveryConfirmedBy`.
- No promised/expected delivery date at order level usable for on-time; Product.estimatedFulfillmentDays exists but not a promise date. Therefore delivery reliability measured as median days from payment to delivery.

### Reviews link to purchases
- `ProductReview.orderId` and `VendorReview.orderId` optional FK to Order.
- Verified purchase = review with orderId not null and order paymentStatus PAID and status DELIVERED/COMPLETED.
- Reviews can be hidden (isHidden) or unapproved (isApproved false); loader restricts to approved and not hidden.
- Unique per user+product/store, so one review per buyer.

### Seller-fault return mapping
- ReturnReason seller-fault: NOT_AS_DESCRIBED, DAMAGED, WRONG_ITEM, NOT_RECEIVED.
- Customer-caused: CHANGE_OF_MIND, OTHER.
- Accepted/approved outcomes: ReturnStatus AWAITING_REFUND or CLOSED (not REJECTED/ESCALATED/PENDING).

### Store route area
- Public store pages: `app/vendor/[id]` (slug or id).
- Trust page: `app/vendor/[id]/trust/page.tsx`.

### Index coverage
- Store: slug unique, id PK.
- Product: storeId, categoryId.
- Order: idempotencyKey, walletAmountApplied, source, vendorCustomerId. No index on createdAt/status/paymentStatus/store; queries rely on items relation and source index.
- OrderItem: no @@index (only FKs). Queries by deliveredAt and product.storeId rely on FK implicit indexes? Report as potentially unindexed.
- ReturnRequest: orderItemId, customerId, status.
- ProductReview/VendorReview: unique userId+productId/storeId; no store index beyond FK.
- Aggregate queries use where on paymentStatus/status/source and items.some.product.storeId; bounded by store scope but not all columns indexed.

## Metric definitions
- Identity: VERIFIED if Store.isVerified or an APPROVED VendorVerificationApplication exists; verifiedSince from application.updatedAt.
- Tenure: daysOnPlatform = floor((now - store.createdAt)/day); firstSaleAt = earliest paid order createdAt.
- Orders: completed = paid orders DELIVERED/COMPLETED for store in window; lifetimeCompleted = same all-time.
- Fulfilment rate = completed / (completed + seller-cancelled), min 10 orders.
- Cancellation rate = seller-cancelled / (completed + seller-cancelled), min 10 orders; uses vendorRejectedOrdersWhere rule.
- Delivery reliability = median days from paymentConfirmedAt (or createdAt) to deliveredAt for delivered items in window, min 10.
- Seller-fault return rate = seller-fault accepted/approved returns / completed orders in window; suppressed if count < 5.
- Ratings = average of reviews tied to paid delivered orders, excluding store owner; min 5 reviews.
- Window = rolling 90 days; lifetime shown for completed orders only.

## Data availability
| Metric | Computable today | Notes |
|---|---|---|
| Identity | yes | |
| Tenure | yes | |
| Completed orders | yes | |
| Fulfilment rate | yes | |
| Cancellation rate | yes | reuses trust-metrics |
| Delivery reliability | yes | median time-to-deliver, no promise date |
| Seller-fault returns | yes | suppressed small counts |
| Verified-purchase ratings | yes | orderId linkage |
| Composite score | no | intentionally not built |
