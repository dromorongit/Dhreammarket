# Seller & Admin Returns UI Design

## 1. Findings

### Areas discovered
- Vendor dashboard: `app/dashboard/vendor/`. Pages are server components wrapped in a `validation.tsx` server component (`app/dashboard/vendor/orders/validation.tsx`) that reads the `token` cookie, verifies it via `verifyToken` (`@/lib/auth-middleware`), requires `role === 'VENDOR'`, and redirects to `/login?redirect=...`. Middleware (`middleware.ts`) protects `/dashboard/vendor` for `VENDOR|ADMIN|SUPER_ADMIN`. Vendor pages fetch data in server components and pass it to `page.client.tsx` clients.
- Admin dashboard: `app/dashboard/admin/` (`ADMIN|SUPER_ADMIN` via middleware) and `app/dashboard/super-admin/` (`SUPER_ADMIN` via middleware). Admin API routes (`app/api/admin/...`) authenticate with `requireSuperAdmin` (`@/lib/adminAuth`): cookie token, `verifyToken`, require `SUPER_ADMIN`, else 401/403. API routes return `NextResponse` errors, never render pages.
- No existing confirmation-dialog/modal component exists; none will be added from a library. The new confirm steps are small accessible client components (see component list).
- No `@testing-library/react` or jsdom in devDependencies; vitest runs in `node` environment; tests live next to source as `*.test.ts`/`*.test.tsx`. Existing `.test.tsx` files: none. Page gating is tested by calling the server page function with mocked `next/headers`, `next/navigation`, `auth-middleware`, `feature-flags` and `prisma` (pattern from `lib/returns/ui/server.test.ts` and `app/receipt/[token]/page.static.test.ts`).

### Authentication & ownership (new pages follow exactly)
- Vendor pages: `isReturnsFlowEnabled()` first → `notFound()`. Then `getVendorSession()` (new helper, `lib/returns/ui/vendor-session.ts`): read `token` cookie, `verifyToken`, require `role === 'VENDOR'`; no token → `redirect('/login')`; wrong role → `notFound()`. Then DB access. Ownership: load the return request only where `orderItem.product.store.userId === vendorId` (a seller's stores are `Store` rows where `Store.userId === userId`; `Store.userId` is unique, so one store per seller). A foreign/missing request → identical `notFound()` (no hint). IDs/roles are never trusted from the client.
- Admin pages: `isReturnsFlowEnabled()` first → `notFound()`. Then `getSuperAdminSession()` (new helper, `lib/returns/ui/admin-session.ts`): cookie token, `verifyToken`, require `SUPER_ADMIN`; no token → `redirect('/login')`; wrong role → `notFound()`. API actions (`decide`, `close`, new `escalate`) are super-admin-only routes the pages POST to.

### Requested amount storage
- `ReturnRequest` has NO `requestedAmount` field (schema: `id, orderItemId, customerId, status, reason, returnRequired, quantity, policySnapshot Json, escalationDeadline, createdAt, updatedAt`; `policySnapshot` = `{ windowDays, vendorResponseHours, deliveredAt }`). The requested amount is not persisted anywhere visible to these screens.
- The UI therefore displays the order item line total (unit price × quantity, computed in integer pesewas from the price string via `parseAmountToPesewas`, then integer multiplication) as the reference amount, labelled "Item total". The accept/approve amount input defaults to this reference and is capped client-side at it; the server (`vendorRespond`/`adminDecide` via `Caps`) remains the authority and rejects over-limit amounts with 409.
- Seller views select: `id, status, reason, quantity, escalationDeadline, createdAt`, plus `orderItem { id, quantity, price, product { id, name, images { url } } }`. Admin views additionally select `order { id }` (order reference only) and `refunds { id, status, amount }` (read-only linked refund). No `customerId`, `customer`, `order.user`, `profile`, email, phone, or address fields are ever selected. Event `note` is never read/displayed.

### Existing APIs reused (unmodified)
- `POST /api/vendor/returns/[returnId]/respond` — `{ decision: 'APPROVE'|'DENY', amount?, note? }`, VENDOR, ownership enforced, unknown fields 400.
- `POST /api/admin/return-decisions/[returnId]` — `{ decision, amount, note }`, SUPER_ADMIN.
- `POST /api/admin/return-decisions/[returnId]/close` — no body, SUPER_ADMIN; 200 closed / 200 noop / 409 REFUND_NOT_PROCESSED+refundStatus / 409 NO_REFUND / 404.
- `lib/returns/return-service.ts` exports `escalate(client, { returnRequestId, actor: 'SYSTEM'|'ADMIN', actorId, reason?, now })` — PENDING→ESCALATED (SYSTEM only if overdue). NO route exists for it; this build adds `app/api/admin/return-decisions/[returnId]/escalate/route.ts`.
- `lib/returns/ui/`: `amount.ts` (parseAmountToPesewas, formatGhs, pesewasToGhsString, integer math), `reasons.ts`, `status-copy.ts` (customer copy), `errors.ts`, `form.ts`, `server.ts` (getCustomerSession), `eligibility.ts`, plus `lib/returns/overdue.ts` (`isOverdue`, `findSettledReturns`) and `state-machine.ts` (canTransition, ReturnStatus type).
- Statuses: PENDING, ITEM_IN_TRANSIT, ITEM_RECEIVED, AWAITING_REFUND, ESCALATED, REJECTED, CLOSED. Transitions per state-machine.ts/TRANSITION_TABLE.

### Money & privacy
- All GHS display via `formatGhs` (Intl en-GH, currency GHS) on strings from `pesewasToGhsString`. No JS float money arithmetic. Amounts validated with `parseAmountToPesewas` (integer pesewas).
- Sellers see no customer name/email/phone/address. Admins see order reference (`order.id`) only; no contact details. Free-text notes are write-only: never read back, never displayed to customers. No localStorage/sessionStorage. No `process.env.RETURNS_FLOW_ENABLED` in client code.

## 2. Page map

| Page | Route | Kind | Flag off | Data source |
|---|---|---|---|---|
| Seller returns inbox | `/dashboard/vendor/returns` | Server | notFound() | `returnRequest.findMany` where orderItem.product.store.userId === vendorId; PENDING first |
| Seller respond | `/dashboard/vendor/returns/[returnId]` | Server (+client form) | notFound() | `returnRequest.findUnique` where id + store ownership; read-only unless PENDING |
| Admin returns queue | `/dashboard/admin/returns` | Server | notFound() | `returnRequest.findMany` latest 300, bucketed in memory by server clock |
| Admin return detail | `/dashboard/admin/returns/[returnId]` | Server (+client actions) | notFound() | `returnRequest.findUnique` id, with order ref, item, refunds, events |

New directories (all confirmed free): `app/dashboard/vendor/returns/`, `app/dashboard/admin/returns/`, `components/returns/vendor/`, `components/returns/admin/`, `lib/returns/ui/` (new filenames: `seller-copy.ts`, `admin-copy.ts`, `actions.ts`, `vendor-session.ts`, `admin-session.ts`), `docs/returns-disputes/` (design + manual test docs).

## 3. Component list

Shared: `components/returns/vendor/ReturnConfirmStep.tsx` — accessible confirmation step (role="dialog", aria-modal, visible label, exact GHS amount text, confirm/cancel buttons, disabled in flight, Escape cancels).

Vendor:
- `components/returns/vendor/VendorReturnRow.tsx` — server-rendered inbox row: item name + image, reason label, quantity, reference amount, status badge (existing `ReturnStatusBadge`), time left until deadline (server clock), link to respond page.
- `components/returns/vendor/VendorReturnRespond.tsx` ('use client') — accept flow (amount input prefilled at reference, pesewa validation, max = reference, min 0.01, confirmation step with exact GHS + earnings-deduction text, POST respond APPROVE) and reject flow (required note ≤ 500 chars, confirmation, POST respond DENY); buttons disabled in flight; 409/already-actioned shown as friendly message with refresh option; success shows new status.

Admin:
- `components/returns/admin/AdminReturnQueue.tsx` — server-rendered bucket sections (Needs escalation / Needs decision / Awaiting refund / Ready to close / Done) with counts, rows: short return id, order reference, item name, reason, quantity, reference amount, status, age, deadline for escalations, linked refund status+amount where present.
- `components/returns/admin/AdminReturnDetail.tsx` ('use client') — item, reason, quantity, reference amount, event timeline (event type, time, actor label; notes NOT displayed), linked refund status/amount; action buttons per action matrix (Escalate → POST escalate route; Approve → amount input + confirmation + POST decision APPROVE; Deny → note + confirmation + POST decision DENY; Close → POST close route when refund PROCESSED; 409 messages for REFUND_NOT_PROCESSED/NO_REFUND); buttons disabled in flight; router.refresh() on success.

Existing reused: `ReturnStatusBadge`, `ReturnTimeline` (customer timeline component reused for admin event timeline shape), `Button`, `Badge`, `Card`, `EmptyState`, `Input`, `Textarea`, `Skeleton`, `formatGhs`, `reasonLabel`, `apiErrorToCopy`, `isOverdue`, `findSettledReturns`.

## 4. Data selected per page

Seller inbox (`vendor/returns/page.tsx`):
```ts
returnRequest.findMany({
  where: { orderItem: { product: { storeId: { in: storeIds } } } },
  orderBy: { createdAt: 'desc' },
  select: {
    id, status, reason, quantity, escalationDeadline, createdAt,
    orderItem: { select: { id, quantity, price, product: { select: { id, name, images: { select: { url } } } } } },
  },
})
```

Seller respond (`vendor/returns/[returnId]/page.tsx`):
```ts
returnRequest.findUnique({
  where: { id: returnId },
  select: {
    id, status, reason, quantity, escalationDeadline, createdAt,
    orderItem: { select: { id, quantity, price, deliveredAt, orderId, product: { select: { id, name, images: { select: { url } } } } } },
    refunds: { select: { id, status, amount } }, // read-only context
  },
})
```
then verify `orderItem.product.store.userId === vendorId` (ownership enforced in the query via storeIds, plus explicit guard).

Admin queue (`admin/returns/page.tsx`): same shape as inbox across all stores + `order { select: { id } }` + `refunds { select: { id, status, amount } }`, latest 300, bucketed in memory.

Admin detail (`admin/returns/[returnId]/page.tsx`): findUnique id with `orderItem { product { name, images }, order { id } }`, `refunds { id, status, amount }`, `events { id, eventType, createdAt, createdBy } orderBy createdAt asc`. No customer fields.

## 5. Action-to-API map

| Actor | When | UI action | POST body | Route |
|---|---|---|---|---|
| Seller | PENDING | Accept (approve) | `{ decision: 'APPROVE', amount }` | `/api/vendor/returns/[returnId]/respond` |
| Seller | PENDING | Reject | `{ decision: 'DENY', note }` | `/api/vendor/returns/[returnId]/respond` |
| Admin | PENDING + overdue | Escalate | none | `/api/admin/return-decisions/[returnId]/escalate` (new) |
| Admin | ESCALATED | Approve | `{ decision: 'APPROVE', amount }` | `/api/admin/return-decisions/[returnId]` |
| Admin | ESCALATED | Deny | `{ decision: 'DENY', note }` | `/api/admin/return-decisions/[returnId]` |
| Admin | AWAITING_REFUND + refund PROCESSED | Close | none | `/api/admin/return-decisions/[returnId]/close` |

The server remains the authority; the UI only hides/disables actions from `actions.available()`.

## 6. Seller status copy (seller-copy.ts)

| Status | Label | Next step |
|---|---|---|
| PENDING | Needs your response | Accept or reject before the response deadline |
| ITEM_IN_TRANSIT | Item in transit | Wait for the item to arrive |
| ITEM_RECEIVED | Item received | No action needed from you |
| AWAITING_REFUND | Accepted - refund in progress | Customer refunded now; amount deducted from your earnings |
| ESCALATED | Under review by Dhream | Wait for Dhream's decision |
| REJECTED | Declined by Dhream | No further action needed |
| CLOSED | Completed | No further action needed |

`SELLER_STATUS_COPY: Record<ReturnStatus, SellerStatusCopy>` — adding a status fails type-checking.

## 7. Admin status copy & queues (admin-copy.ts)

| Status | Queue (condition) |
|---|---|
| PENDING + deadline passed | Needs escalation |
| ESCALATED | Needs decision |
| AWAITING_REFUND + refund not PROCESSED | Awaiting refund |
| AWAITING_REFUND + refund PROCESSED | Ready to close |
| CLOSED, REJECTED | Done |
| PENDING not overdue | (with seller — not an admin queue) |
| ITEM_IN_TRANSIT, ITEM_RECEIVED | (reserved — not an admin queue) |

## 8. Action matrix (actions.ts)

| Status | Seller | Admin |
|---|---|---|
| PENDING, not overdue | Respond | — |
| PENDING, overdue | Respond | Escalate |
| ESCALATED | — | Approve, Deny |
| AWAITING_REFUND, refund not PROCESSED | — | — |
| AWAITING_REFUND, refund PROCESSED | — | Close |
| CLOSED / REJECTED / ITEM_* | — | — |

`confirmationText(decision, amountPesewas, role)`: seller approve → `Refund GH₵10.50 to the customer now. The amount will be deducted from your earnings.`; admin approve → `Refund GH₵10.50 to the customer now.`; deny → `Reject this return request. The customer will not be refunded.`

## 9. Confirmation step rules (real-money actions)

First click opens confirmation stating exact GHS amount, that the customer is refunded now, and (seller) that the amount is deducted from earnings. Only the confirmation button sends the request. Every action button disabled while in flight. 409/already-actioned → friendly message + refresh option, never a crash.

## 10. Error copy (never raw server messages)

| Situation | Message | Action |
|---|---|---|
| 409 already actioned / conflict | This return request has already been handled. | Refresh |
| 409 over limit / cap | The amount is more than can be refunded for this item. | Enter a lower amount |
| 404 / not found | We could not find this return request. | Return to returns list |
| 401/403 | Please sign in with the right account. | Sign in |
| 5xx / network | Something went wrong. Please try again. | Try again |

## 11. Exhaustiveness & testing

- `SELLER_STATUS_COPY` / `ADMIN_STATUS_COPY` typed as `Record<ReturnStatus, ...>`; tests assert every `ReturnStatus` value has copy. `actions.available` covers the full matrix incl. overdue boundary ±1s. `confirmationText` covers awkward amounts (0.01, large values); all money via `formatGhs`/`pesewasToGhsString`.
- No DOM testing library exists; no DOM tests are added. Pure helpers and server gating are tested. Server page tests assert flag-off → `notFound()` before any session/DB call, foreign ownership → `notFound()`, select shapes contain no customer/contact fields.
- No new file imports `createRefund`, writes `refund`/`payment`/`wallet`/`vendorBalanceAdjustment`/`vendorPayout` rows, references `localStorage`/`sessionStorage`, or reads `process.env.RETURNS_FLOW_ENABLED` directly (only via `isReturnsFlowEnabled()`).

## 12. Follow-ups (out of scope)
- Navigation links from seller dashboard and admin dashboard to the new returns screens.
- Customer/seller/admin notifications when a return is decided or closed.
- Scheduled overdue escalation job (system actor) — currently only the admin escalate route exists.
- Attachments, description field, requestedAmount persistence (not stored today; would require schema/API changes — refused here).
- Exact bucket counts for the admin queue (v1 buckets over the latest 300 fetched requests).

## Stop gates evaluated
- Existing areas can be extended with new directories only: no existing file modified.
- Seller stores resolved server-side via `Store.userId === vendorId` (existing pattern: `Store.userId` unique).
- No escalate route exists; the new route path is free.
