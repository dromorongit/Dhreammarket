# Trust Phase 2 performance

## Added indexes

| Index | Table | Serves | Write cost |
|---|---|---|---|
| `orders_source_paymentStatus_createdAt_idx` | orders | completed/cancelled counts and first-sale lookup (source + paymentStatus + createdAt) | +1 index maintenance on every order insert/update; low overhead |
| `order_items_productId_deliveredAt_idx` | order_items | store attribution joins and delivery reliability (productId + deliveredAt) | +1 index maintenance on every order item insert/update |
| `product_reviews_productId_isApproved_isHidden_idx` | product_reviews | verified-purchase rating aggregate (productId + approved/hidden) | +1 index maintenance on review insert/update |
| `vendor_reviews_storeId_isApproved_isHidden_idx` | vendor_reviews | verified-purchase rating aggregate (storeId + approved/hidden) | +1 index maintenance on review insert/update |
| `return_requests_status_createdAt_idx` | return_requests | seller-fault return count (status + createdAt) | +1 index maintenance on return insert/update |

## Two-line change for route and page (not applied)

Import (one line):

```ts
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'
```

Replace the loader call (one line):

```ts
// app/api/trust/sellers/[storeId]/route.ts
const result = await getCachedSellerTrustProfile(storeId)

// app/vendor/[id]/trust/page.tsx
const result = await getCachedSellerTrustProfile(store.id)
```

The feature-flag check remains the caller's first statement, outside the cache. Cached dates are ISO strings; revive them to `Date` before `composeProfile`.

## Read-only staging checks

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM orders WHERE "source" = 'ONLINE' AND "paymentStatus" = 'PAID' AND "status" IN ('DELIVERED','COMPLETED') AND "createdAt" >= now() - interval '90 days';
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM orders WHERE "vendorRejected" = true AND "paymentStatus" IN ('PAID','REFUNDED') AND "source" = 'ONLINE' AND "createdAt" >= now() - interval '90 days';
EXPLAIN (ANALYZE, BUFFERS) SELECT "deliveredAt" FROM order_items WHERE "deliveredAt" IS NOT NULL AND "deliveredAt" >= now() - interval '90 days' ORDER BY "deliveredAt" DESC LIMIT 5000;
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM return_requests WHERE "status" IN ('AWAITING_REFUND','CLOSED') AND "createdAt" >= now() - interval '90 days';
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM product_reviews WHERE "isApproved" = true AND "isHidden" = false AND "orderId" IS NOT NULL;
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM vendor_reviews WHERE "storeId" = 'store-id' AND "isApproved" = true AND "isHidden" = false AND "orderId" IS NOT NULL;
```

## Go / no-go

Go only if every plan above avoids a sequential scan on `orders`, `order_items`, or the review tables for a store with typical volume. Any sequential scan on those tables is a no-go until the plan changes or the index is revised.