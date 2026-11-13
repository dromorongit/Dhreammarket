# Unified order inbox — step 1 audit plan

## How orders are fetched today

**Client** `app/dashboard/vendor/orders/page.client.tsx`
- Fetches `GET /api/vendor/orders?page&limit&search&status&source&unpaid` on mount and whenever `page`, `search`, `statusFilter`, `sourceFilter`, or `unpaidOnly` changes (page.client.tsx:119-121, 136-168).
- Client state: `page` (default 1), `limit` (fixed 20), `search`, `statusFilter` (default `all`), `sourceFilter` (default `all`), `unpaidOnly` (default false) (page.client.tsx:98-105).
- Pagination: client reads `data.pagination.total` / `totalPages` and renders Previous/Next (page.client.tsx:160-161, 680-704).
- Sort: none client-side. Default server order is `createdAt desc` (API below). No sort param is sent by the client.

**API** `app/api/vendor/orders/route.ts`
- Params accepted: `page`, `limit` (default 20), `search`, `status`, `orderType`, `fulfillmentStatus`, `source`, `unpaid` (route.ts:61-68).
- Filters applied server-side (route.ts:73-113):
  - `deletedAt: null`
  - Base scope: `OR: [{ paymentStatus: 'PAID' }, { source: 'MANUAL' }]` — paid online orders plus all manual orders (route.ts:76-80).
  - `status` (OrderStatus), `source` (ONLINE/MANUAL), `unpaid` → `paymentStatus: { not: 'PAID' }`, `orderType`, `fulfillmentStatus`, `search` on `user.email` or `order.id` (contains, insensitive).
- Sort: `orderBy: { createdAt: 'desc' }` only (route.ts:175). No sort parameter.
- Pagination: `skip`/`take` plus a separate `order.count` (route.ts:176-189).
- Scoping (no storeId on Order): vendor's store is loaded, `productIds = store.products[].id`, then `items.some: { productId: { in: productIds } }` (route.ts:39-57, 116-124).
- Returned fields include `source`, `channel`, `paymentStatus`, `status`, `receiptToken` → `receiptUrl`, `customerPhone`, `deliveryCost` (manual only) (route.ts:225-286). Shape from `lib/public-selects.ts:166` (`VENDOR_ORDER_SELECT`) + `VENDOR_ORDER_ITEM_SELECT` (lib/public-selects.ts:177).

Filters/sorts that exist today: status, source (ONLINE/MANUAL), unpaid toggle, search (order ID/customer email). **Channel, date range, and payment-status granularity are not filterable; sort is fixed `createdAt desc` (unverified that no sort param is honored).**

## Scoping and indexes

Order has no `storeId` (prisma/schema.prisma:494-556). Vendor scope = orders whose items reference products in the vendor's store (`items.some.productId in store.productIds`).

Indexes relevant to this query:
- `Product @@index([storeId])` (schema.prisma:315) — supports fetching the vendor's product IDs.
- `OrderItem @@index([productId, deliveredAt])` (schema.prisma:592) — composite only; no plain `productId` index (unverified).
- `Order @@index([source])`, `Order @@index([source, paymentStatus, createdAt])` (schema.prisma:552-553) — partially covers the base scope + sort.
- `OrderItem.count` for the total repeats the same `items.some` subquery (route.ts:179-188).

Risk: for a vendor with thousands of orders, the `items.some` subquery on `OrderItem.productId` plus the separate count may be slow; a dedicated `OrderItem(productId)` index or a denormalized `storeId` on Order may be needed (unverified — no EXPLAIN run).

## What a seller can see at a glance today

- Online and manual together: yes (base OR includes both), with an ONLINE/MANUAL source badge (SOURCE_BADGE, page.client.tsx:80-83; rendered page.client.tsx:483-485).
- Sales channel: `channel` is returned by the API (route.ts:225) but **not displayed**; only source is badged (unverified that channel is surfaced anywhere in the row).
- Unpaid vs paid: `paymentStatus` exists in data; an "Unpaid Only" toggle exists (page.client.tsx:101, 437-444), but there is no unpaid count or unpaid-first ordering.
- Needs dispatching: `status` filter offers PROCESSING/SHIPPED (page.client.tsx:418-424) and `fulfillmentStatus` is API-supported but not exposed client-side (route.ts:103-105). No dedicated "to dispatch" chip or count.

Missing for "what is unpaid, and what needs dispatching today?": no unpaid count, no to-dispatch count, no channel badge, no pay-link-sent state, default sort is newest-first not unpaid-first.

## Quick actions per row (all inline, no detail page required)

- Mark as paid (`confirm-payment`, manual only, opens method dialog) (page.client.tsx:201-219).
- Mark shipped / delivered / completed / cancelled via `MANUAL_STATUS_TRANSITIONS` (page.client.tsx:85-92, 554-597).
- Set delivery cost (inline editor, manual only) (page.client.tsx:221-271).
- Share receipt (clipboard) / WhatsApp receipt (page.client.tsx:312-321, 598-611).
- Send pay link (`PayLinkButton`, only when `NEXT_PUBLIC_PAYLINK_ENABLED === 'true'`, manual + unpaid + not cancelled) (components/vendor/PayLinkButton.tsx:19-95).
- View Details (navigates to `/dashboard/vendor/orders/[orderId]`) — the only action requiring a detail page (page.client.tsx:536-538).

## Mobile rendering (380px) — judged from classes

- Rows are cards, not a table; `flex flex-col sm:flex-row` stacks on small screens (page.client.tsx:479). No horizontal scroll (unverified).
- Tap targets: buttons use `min-h-[44px]` (page.client.tsx:382, 549, 559, etc.), acceptable.
- Awkward on 380px: the action area stacks up to 6 inline buttons (mark paid/ship/deliver/complete/cancel + share receipt + delivery cost) plus View Details; the filter bar (search + 2 selects + unpaid button) wraps; order date and profit text compete for width. A card stack with many actions per row will feel crowded.

## Unpaid manual order with pay link sent — row state

Row shows: status badge, source badge, customer, total, item count, and PayLinkButton. Payment status is **not** badged in the row (page.client.tsx:468-534). PayLinkButton renders "Send pay link" until a link exists, then shows the link + Copy/Share on WhatsApp (components/vendor/PayLinkButton.tsx:65-95). There is no explicit "link sent / waiting / paid" chip in the row.

Data needed to show that state: `paymentStatus` (have), `receiptToken`/`receiptUrl` (have, indicates a link was created). A "link sent at" timestamp does not appear to be returned (unverified).

## Dashboard home counts

`app/dashboard/vendor/page.client.tsx` shows Revenue, Orders (this month), Followers, Conversion Rate (page.client.tsx:422-463). **No unpaid-order count and no to-dispatch count.**

Summary endpoint `GET /api/dashboard/vendor` (app/api/dashboard/vendor/route.ts) returns revenue/orderCount/bookings/topProducts/topServices/couponUsages/followerCount/analytics — no unpaid or to-dispatch counts (unverified that no other summary endpoint exists).

## Recommended smallest change

Files to change:
1. `app/dashboard/vendor/orders/page.client.tsx` — add filter chips `All | Unpaid | To dispatch` plus channel chips (from `SaleChannel` enum values: WHATSAPP, INSTAGRAM, FACEBOOK, CALL, WALK_IN, OTHER); default sort unpaid-first (pass `sort` param); show channel badge next to source badge; add a pay-link/unpaid state chip; keep existing inline actions.
2. `app/api/vendor/orders/route.ts` — accept `sort` param (`createdAt desc` default; `unpaid-first` = `paymentStatus asc, createdAt desc`); optionally accept `channel` filter (schema.prisma:3258 SaleChannel).

New API fields: none strictly needed (channel, paymentStatus, receiptToken already returned). A "pay link sent" timestamp is not present (unverified).

New indexes: none required for the change itself; `OrderItem(productId)` may be needed for scale at thousands of orders (unverified).

Risks: changing default sort alters existing ordering (mitigate with explicit `sort` param defaulting to current behavior); `items.some` subquery performance at scale unverified; adding channel chips assumes `channel` is reliably populated on orders (unverified).
