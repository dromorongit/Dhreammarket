# Manual Test Script

## Flag off
- Unset TRUST_PROFILE_ENABLED.
- GET /api/trust/sellers/<id> returns 404.
- /vendor/<slug>/trust returns 404 (notFound).
- Confirm zero DB calls (mocked tests).

## Flag on
- Set TRUST_PROFILE_ENABLED=true.

Cases:
1. Seller with many delivered orders: verify completed, fulfilment, cancellation, delivery median, returns, rating against SQL.
2. Brand-new seller: insufficient data states, no percentages.
3. Seller with cancellations: cancellation rate.
4. Seller with returns below 5: suppressed band "Fewer than 5", no exact count/rate.
5. Seller with returns above 5: rate shown.
6. Seller with no reviews: insufficient.

## SQL checks (read-only)
Completed orders (window):
SELECT count(*) FROM orders o WHERE o."paymentStatus"='PAID' AND o.status IN ('DELIVERED','COMPLETED') AND o.source='ONLINE' AND o."createdAt" >= now() - interval '90 days' AND EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id=oi."productId" WHERE oi."orderId"=o.id AND p."storeId"=$1);

Lifetime completed: same without date filter.

Seller-cancelled (window):
SELECT count(*) FROM orders o WHERE o."vendorRejected"=true AND o."paymentStatus" IN ('PAID','REFUNDED') AND o.source='ONLINE' AND o."createdAt" >= now() - interval '90 days' AND NOT EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id=oi."productId" WHERE oi."orderId"=o.id AND p."storeId"<>$1) AND EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id=oi."productId" WHERE oi."orderId"=o.id AND p."storeId"=$1);

Delivery median: compute median of (delivered_at - payment_confirmed_at) days for order_items with delivered_at not null in window for store.

Seller-fault returns: SELECT count(*) FROM return_requests r JOIN order_items oi ON oi.id=r."orderItemId" JOIN products p ON p.id=oi."productId" WHERE p."storeId"=$1 AND r.reason IN ('NOT_AS_DESCRIBED','DAMAGED','WRONG_ITEM','NOT_RECEIVED') AND r.status IN ('AWAITING_REFUND','CLOSED') AND r."createdAt" >= now() - interval '90 days';

Ratings: SELECT count(*), avg(rating) FROM product_reviews pr JOIN products p ON p.id=pr."productId" WHERE p."storeId"=$1 AND pr."orderId" IS NOT NULL AND pr."isApproved"=true AND pr."isHidden"=false AND pr."userId"<> (store owner) AND EXISTS (order paid delivered). Plus vendor_reviews.

## Mobile width
- Check at 360px readable.

## Data leakage
- Serialize response and page; no customer identifiers.

## Follow-ups
- Link from store/product pages to profile.
- Vendor-facing my trust profile view.
- Cache/materialized snapshot if slow.
- Rate limiting (currently search config).
- Review integrity tooling.
- Delivery promise date if added.
