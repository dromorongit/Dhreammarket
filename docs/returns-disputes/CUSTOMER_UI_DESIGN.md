# Customer Returns UI Design

## 1. Findings

### Customer-facing route area
Customers view orders under `app/dashboard/customer/`:
- `app/dashboard/customer/layout.tsx` wraps every page in `CustomerDashboardValidation` (`app/dashboard/customer/validation.tsx`), a server component that reads the `token` cookie, verifies it via `verifyTokenEdge` (`@/lib/auth-edge`), validates the session via `validateSession` (`@/lib/auth-db`), requires `role === 'CUSTOMER'`, and redirects unauthenticated/invalid users to `/login?redirect=/dashboard/customer`.
- Customer pages: `orders/page.tsx` (list), `orders/[id]/page.tsx` (detail, client component, fetches `/api/orders/...`), `collections`, `loyalty`, `profile`, `service-requests`, `settings`, `wishlist`.
- Auth cookie: `token` (JWT, verified with `jose`; session row checked in Prisma). API routes (`app/api/returns/route.ts`, `[returnId]/route.ts`) read `request.cookies.get('token')`, call `verifyToken`, require `CUSTOMER`, clear the cookie on 401.
- Styling: Tailwind with custom tokens (`deep-navy`, `royal-blue`, `premium-gold`, slate scale). Shared components: `Button`, `Card` (+Header/Content/Footer/Title), `Badge`, `EmptyState`, `Skeleton` (+SkeletonCard), `Input`, `Textarea`, `OrderTimeline` (+EventTimeline). Font: `font-sans`. Dates already rendered with `toLocaleDateString('en-GH')` on order pages. Money displayed via `formatPrice` (Intl en-GH, GH₵ symbol) in existing pages.
- No test directory; tests live next to source as `*.test.ts`. Vitest config: `environment: 'node'`, globals. No jsdom, no `@testing-library/react`, no `react` testing utilities in devDependencies. Existing `.test.tsx` files: none.
- Prisma models: `ReturnRequest` (id, orderItemId, customerId, status ReturnStatus, reason ReturnReason, quantity, policySnapshot Json, escalationDeadline, createdAt, updatedAt), `ReturnRequestEvent` (eventType, note, createdBy, createdAt), `ReturnRequestAttachment` (url, publicId, mimeType, sizeBytes). IDs are cuid (`[a-z0-9]`).
- `lib/returns/eligibility.ts`: `checkReturnEligibility(input) -> { eligible, maxRefundAmount: Prisma.Decimal } | { eligible, reason: EligibilityReason }`. Reasons: NOT_DELIVERED, WINDOW_EXPIRED, NOT_RETURNABLE_PRODUCT, ORDER_NOT_PAID, FULLY_REFUNDED, OPEN_REQUEST_EXISTS, INVALID_DELIVERY_DATE. `getReturnWindowDays()` default 7, `getVendorResponseHours()` default 72 in `lib/feature-flags.ts`. `isReturnsFlowEnabled()` reads `process.env.RETURNS_FLOW_ENABLED` (defaults false).
- Returns API (existing, unmodified):
  - `POST /api/returns` body: orderItemId, reason, quantity, requestedAmount, attachments. Unknown fields -> 400. Ownership enforced server-side (order item's order.userId === payload.userId); foreign/missing -> 404 'Order item not found or access denied'. Errors returned as `{ error, code }` with HTTP status from `createReturnError` (e.g. 409 OPEN_REQUEST_EXISTS, 409 INVALID_AMOUNT, 400 INVALID_QUANTITY).
  - `GET /api/returns` -> `{ returnRequests: [{ id, status, reason, quantity, escalationDeadline, createdAt, updatedAt, orderItemId }] }` newest first. **No requestedAmount field** is stored/returned.
  - `GET /api/returns/[returnId]` -> `{ returnRequest: { id, status, reason, quantity, escalationDeadline, createdAt, updatedAt, orderItemId, policySnapshot } }`. **No event history and no requestedAmount are returned.** Ownership enforced via customerId.
- Follow-ups (not done here, require modifying existing files or backend): entry-point link from order detail page (`orders/[id]/page.tsx` is a client component that would need modification), description field on opening a return (POST body has no description; not added), attachment upload (UI has no file upload per spec), notifications.

### Decision: where new files live
- Pages: `app/dashboard/customer/returns/page.tsx` (my returns), `app/dashboard/customer/returns/new/page.tsx` (request, `?orderItemId=`), `app/dashboard/customer/returns/[returnId]/page.tsx` (detail). All under the customer layout, so they inherit cookie/session/CUSTOMER auth + redirect exactly like existing customer pages.
- Components: `components/returns/`.
- UI helpers: `lib/returns/ui/`.
- Server shared eligibility helper: `lib/returns/ui/eligibility.ts` (used by both the new page and the eligibility route; reuses `checkReturnEligibility` without reimplementing policy).
- Eligibility route: `app/api/returns/eligibility/route.ts`.
- Docs: `docs/returns-disputes/` (exists).

## 2. Page map

| Page | Route | Kind | Flag off | Data source |
|---|---|---|---|---|
| My Returns | `/dashboard/customer/returns` | Server | notFound() | `returnRequest.findMany` where customerId, newest first |
| Request a Return | `/dashboard/customer/returns/new?orderItemId=` | Server | notFound() | shared `getOrderItemEligibility`; form POSTs to `/api/returns` |
| Return Detail | `/dashboard/customer/returns/[returnId]` | Server | notFound() | return request where id + customerId; order item + product; events |
| (n/a) | `returns/new` static beats `returns/[returnId]` dynamic | | | |

Each returns page also gets `returns/loading.tsx` and `returns/error.tsx` following root conventions. Pages are per-user data; `cookies()` usage makes them dynamic automatically.

## 3. Component list

- `ReturnStatusBadge` — `components/returns/ReturnStatusBadge.tsx`: label + tone from `status-copy`, badge variant mapped from tone, `aria-label` carries description so meaning does not rely on colour alone.
- `ReturnTimeline` — `components/returns/ReturnTimeline.tsx`: vertical list of `{ when, actor, what, note? }` events (actors: You / Seller / Dhream / System), following `EventTimeline` conventions; empty state when no events.
- `ReturnRequestForm` — `components/returns/ReturnRequestForm.tsx` ('use client'): reason select, quantity only when item quantity > 1, amount input prefilled at max and editable downward, plain-language window/next-step summary, disabled-while-sending submit, inline field errors, top alert via `errors.ts`, success state linking to the new detail page. No file upload. Native inputs with `htmlFor` labels, `aria-describedby` errors, `role="alert"` top alert, >=44px tap targets, single column fits 360px.
- `ReturnListItem` — `components/returns/ReturnListItem.tsx`: link to detail, status badge, item name, unit price + quantity, date.
- `ReturnEmptyState` — `components/returns/ReturnEmptyState.tsx`: wraps shared `EmptyState`.

## 4. Data flow

1. Customer opens a return from an order (entry-point link is a follow-up) -> `/dashboard/customer/returns/new?orderItemId=...`.
2. New page (server): flag check -> session -> shared eligibility helper -> item summary + eligibility. Eligible: render form with max amount prefilled. Ineligible: friendly explanation via `errors.ts` + link back to order. Foreign/missing item: `notFound()`.
3. Form submits `POST /api/returns` (orderItemId, reason, quantity, requestedAmount). Button disabled in flight. 409 `OPEN_REQUEST_EXISTS` -> friendly message, not an error page.
4. Detail page: status badge + copy + next step, item summary, reason, requested amount note, events timeline (opened by You at createdAt; status changes from events; seller = VENDOR events, Dhream = ADMIN events), CLOSED shows refunded amount when a processed refund exists for the request.
5. List page: requests newest first with badge, item name, price/quantity, date; empty state.

Eligibility route `GET /api/returns/eligibility?orderItemId=&now=`: flag off -> 404, zero DB; auth (401/403 CUSTOMER-only); strict orderItemId validation; load item+order+product+existing requests where order.userId === customerId (else 404, no hint); `checkReturnEligibility` with injected now + `getReturnWindowDays()`; JSON `{ eligible, reason?, maxRefundAmount (string, 2dp), windowDays }`; read-only.

## 5. Status-to-copy table

| Status | Label | Description | Tone | Next step |
|---|---|---|---|---|
| PENDING | Waiting for the seller | The seller has N hours to respond to your return request. | info | The seller will review and respond. If they do not respond in time, Dhream reviews it. |
| ESCALATED | Under review by Dhream | Our team is reviewing your return request. | info | Dhream will approve or decline and let you know the outcome. |
| AWAITING_REFUND | Approved - refund in progress | Your return was approved; the refund is being processed. | success | The refund will be sent to your original payment method. |
| CLOSED | Completed - refund sent | Your return is completed and the refund has been sent. | success | No further action needed. |
| REJECTED | Declined | Your return request was declined. | danger | You can contact support or place a new request if you have new information. |
| ITEM_IN_TRANSIT | In progress | The item is on its way back to the seller. | info | Keep the item packaged; track the return shipment. |
| ITEM_RECEIVED | In progress | The seller has received the returned item. | info | The seller is processing the received item. |

Tone -> Badge variant: info->info, success->success, warning->warning, danger->danger, neutral->default.

## 6. Reason labels

| Reason | Label |
|---|---|
| NOT_AS_DESCRIBED | Not as described |
| DAMAGED | Damaged or broken |
| WRONG_ITEM | Wrong item |
| NOT_RECEIVED | Not received |
| CHANGE_OF_MIND | Change of mind |
| OTHER | Other |

Display order: NOT_AS_DESCRIBED, DAMAGED, WRONG_ITEM, NOT_RECEIVED, CHANGE_OF_MIND, OTHER.

## 7. Error-to-copy table (never raw server messages)

| Source | Message | Suggested action |
|---|---|---|
| NOT_DELIVERED | This item has not been delivered yet, so a return cannot be opened. | Check your order's delivery status. |
| WINDOW_EXPIRED | The return window for this item has closed. | Contact support if there is still a problem with the item. |
| NOT_RETURNABLE_PRODUCT | This product cannot be returned. | Browse the order for other options, or contact support. |
| ORDER_NOT_PAID | The order has not been paid for yet. | Complete payment for the order first. |
| FULLY_REFUNDED | This item has already been fully refunded. | No further refund is available for this item. |
| OPEN_REQUEST_EXISTS | You already have an open return request for this item. | View it in My Returns. |
| INVALID_DELIVERY_DATE | We could not confirm a delivery date for this item. | Contact support for help. |
| UNKNOWN_FIELD / 400 | Invalid request. Please try again. | Retry opening the return. |
| 401 | Please sign in to continue. | Sign in. |
| 403 | You are not allowed to view this page. | Sign in with the right account. |
| 404 | We could not find what you are looking for. | Return to My Returns. |
| 409 | This return request is already being handled. | View it in My Returns. |
| 5xx | Something went wrong on our end. Please try again later. | Retry later. |
| Network failure | No internet connection. Please check your connection and try again. | Reconnect and retry. |

## 8. Exhaustiveness strategy

`status-copy.ts` types `STATUS_COPY` as `Record<ReturnStatus, StatusCopy>` (imported `ReturnStatus` from `@/lib/returns/state-machine`) and `reasons.ts` types `REASON_LABELS` as `Record<ReturnReason, string>`, `errors.ts` types the eligibility map as `Record<EligibilityReason, ErrorCopy>`. Adding a status/reason/reason without copy fails TypeScript. Runtime tests iterate every enum value and assert copy exists.

## 9. Testing approach

Vitest runs in `node` environment; no DOM testing library is installed and none will be added. Tests cover: pure helpers (status-copy, reasons, amount, errors), the shared eligibility server helper (mocked Prisma, real `checkReturnEligibility`), the eligibility route (mocked Prisma/auth/flags/shared helper), and server gating helpers per page (mocked flags/auth/Prisma; static source assertions that `notFound()` is called before any data access, following `app/receipt/[token]/page.static.test.ts`).

## 10. Follow-ups

- Entry-point "Return this item" link on `app/dashboard/customer/orders/[id]/page.tsx` (requires modifying an existing file).
- Free-text description field on opening a return (POST body has none; backend would need it).
- Attachment upload (UI deliberately has no file upload).
- Notifications/emels when the seller or admin acts on a request.
- `GET /api/returns` and `GET /api/returns/[returnId]` do not return requestedAmount or event history; the list shows the order item's price and quantity instead of requested amount, and the detail timeline loads events server-side.
