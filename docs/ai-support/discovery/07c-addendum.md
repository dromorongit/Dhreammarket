# STAGE_F_STEP1C — Addendum (read-only audit)

**Repo:** Dhream Market main app, branch `feat/vendor-reminders` (Next.js 14 + Prisma).  
**Step:** `STAGE_F_STEP1C_ADDENDUM`, mode `READ_ONLY`.  
**Status:** Read-only. No copy, page, FAQ, email, or code file was edited. This file (`07c-addendum.md`) is the only new file.

## Approved decisions (reference)

- **Return review:** The vendor has 1 business day to review a return request, counted from when the buyer submits it. (`refund_timing` decision below is DRAFT, pending founder confirmation.)
- **Refund timing (DRAFT):** once a return is approved, Dhream Market processes the refund within 24 hours; time to reach the buyer's account after that depends on their provider.
- **Cancellation:** Free within 1 hour of payment confirmation if not shipped; after the first hour and before shipment a GHS 5 fee applies; no cancellation once the vendor ships; Paystack's processing fee is not refunded; 4 cancellations in 30 days blocks all cancellations for 3 months; wallet credit returned.

---

## 1. Return review — entries restated as CONFLICTS

The decision says **1 business day from when the buyer submits the return request**. Every site statement that says "3 business days" or "1-3 business days" for vendor review conflicts.

### Entry 2 — `app/refund/page.tsx:128-131` — CONFLICTS — LEGAL

Verbatim: "The vendor will review your request and approve or reject it within 3 business days."

Why CONFLICTS: says 3 business days; decision is 1 business day from submission. Trigger also differs ("vendor receives the item" vs "buyer submits").

Proposed replacement (minimal): "The vendor will review your request and approve or reject it within 1 business day of when you submit it."

LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

### Entry 3 — `app/refund/page.tsx:151-154` — CONFLICTS — LEGAL

Verbatim: "- Return Review: 3 business days after vendor receives the item"

Why CONFLICTS: says 3 business days after vendor receives the item; decision is 1 business day from buyer submission.

Proposed replacement (minimal): "- Return Review: 1 business day after you submit your return request."

LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

### Entry 7 — `app/help/refunds/page.tsx:67` — CONFLICTS

Verbatim: "- Request Review: 1-3 business days"

Why CONFLICTS: says 1-3 business days; decision is 1 business day from submission.

Proposed replacement: "- Request Review: 1 business day after you submit your return request."

### Entry 42 — `app/help/refunds/page.tsx:67` — CONFLICTS

Same as entry 7 (this is the same location, restated per the change-sheet numbering). Verbatim: "- Request Review: 1-3 business days".

### Help returns line 90 — `app/help/returns/page.tsx:90` — CONFLICTS

Verbatim: "Return review takes 3 business days. After approval, refund processing takes 3-5 business days. Depending on your bank, the credit may take 10-14 business days to appear in your account."

Why CONFLICTS: says "Return review takes 3 business days"; decision is 1 business day from submission.

Proposed replacement: "Return review takes 1 business day. After approval, refund processing takes 3-5 business days. Depending on your bank, the credit may take 10-14 business days to appear in your account."

---

## 2. What enforces the vendor return-review deadline in code

### Feature flag / default (hours)

`lib/feature-flags.ts:25-37` — `getVendorResponseHours()` reads `VENDOR_RESPONSE_HOURS` env var; default **72** (hours), valid range 1-720. This is the **hours** unit, not business days.

### Prisma schema (business days)

`prisma/schema.prisma:2609-2613` — `PlatformPolicy` model:
- `vendorResponseBusinessDays Int @default(3)` (line 2613)
- `returnWindowDays Int @default(3)` (line 2612)

### Delivery fallback (business days)

`lib/delivery.ts:28-51` — `getPolicy()` fallback returns `vendorResponseBusinessDays: 3` (line 39), `returnWindowDays: 3` (line 38), `refundProcessingWindowDays: 5` (line 47).

### Return service — deadline computation (hours)

`lib/returns/return-service.ts:172-173`:
```ts
const vendorResponseHours = input.vendorResponseHours ?? getVendorResponseHours()
const escalationDeadline = new Date(now.getTime() + vendorResponseHours * 60 * 60 * 1000)
```
The `escalationDeadline` is stored on the return request (`policySnapshot.vendorResponseHours` at line 178, and the `escalationDeadline` field at line 203). Unit: **hours**, default 72 (= 3 days, not 3 business days).

### Escalation when vendor misses deadline

`lib/returns/return-service.ts:436-484` — `escalate()`:
- SYSTEM actor can escalate only if `now > escalationDeadline` (line 451: `Vendor deadline has not passed` → `NOT_OVERDUE` error).
- Transitions PENDING → ESCALATED.
- ADMIN can also escalate PENDING → ESCALATED without deadline check.

`lib/returns/state-machine.ts:6-15` — transition table: PENDING → ESCALATED allowed for VENDOR, SYSTEM, ADMIN.

`lib/returns/overdue.ts:18-28` — `isOverdue()`: true when `now > escalationDeadline` and status is PENDING/ITEM_IN_TRANSIT/ITEM_RECEIVED.

`lib/returns/ui/actions.ts:25` — if PENDING and overdue → `['ESCALATE']` action available to SUPER_ADMIN.

### What happens when the vendor misses the deadline

The return request stays PENDING with an `escalationDeadline` in the past. No automatic cron escalates it. A SUPER_ADMIN (or SYSTEM) must manually call `escalate()` to move it to ESCALATED, after which an ADMIN can APPROVE (→ AWAITING_REFUND → refund) or DENY (→ REJECTED). There is **no auto-approval, no auto-escalation cron, and no reminder** after the vendor deadline passes. The only scheduled cron jobs are: vendor-completion-reminders, release-expired-reservations, low-stock-alerts, influencer-trial-expiry, daily-sales-summary — none handle return overdue escalation.

`scripts/returns-escalation-report.ts` is a one-off report script (uses `findOverdueReturns`), not a scheduled job.

### API routes

- `app/api/returns/route.ts` (POST) — customer opens a return; calls `openReturn()` which sets `escalationDeadline`.
- `app/api/returns/[returnId]/route.ts` (GET) — customer views their return request (includes `escalationDeadline`).
- `app/api/vendor/returns/[returnId]/respond/route.ts` (POST) — vendor accepts/rejects; calls `vendorRespond()`; requires VENDOR role and store ownership.

### Client-facing copy of the deadline

`lib/returns/ui/status-copy.ts:14` — "The seller has ${getVendorResponseHours()} hours to respond to your return request." (hours, default 72)
`lib/returns/ui/seller-copy.ts:13` — "Respond before the deadline passes."

---

## 3. Return window statements — verbatim, with status vs the returns decision

Decision: return must be started within 1 day of vendor marking order completed (Greater Accra) or 3 days otherwise, counted from vendor marking completed (not from receipt).

| # | File:line | Verbatim | Status vs decision |
|---|-----------|----------|-------------------|
| 1 | `app/refund/page.tsx:77-80` | "Returns must be initiated within 3 days of receiving the product. The product must be in its original condition with all packaging and tags intact." | CONFLICTS — flat 3 days from receiving; decision is 1 day (Greater Accra) / 3 days (otherwise) from vendor marking completed. LEGAL. |
| 2 | `app/refund/page.tsx:128-131` | "The vendor will review your request and approve or reject it within 3 business days." | CONFLICTS — 3 business days; decision is 1 business day from submission. LEGAL. |
| 3 | `app/refund/page.tsx:151-154` | "- Return Review: 3 business days after vendor receives the item" | CONFLICTS — 3 business days; decision is 1 business day from submission. LEGAL. |
| 4 | `app/help/returns/page.tsx:38-40` | "Returns must be initiated within 3 days of receiving your order. Items must be in original condition with packaging intact." | CONFLICTS — flat 3 days from receiving. |
| 5 | `app/help/returns/page.tsx:56-58` | "Vendor reviews your request and provides return instructions within 3 business days." | CONFLICTS — 3 business days; decision is 1 business day from submission. |
| 6 | `app/help/refunds/page.tsx:67` | "- Request Review: 1-3 business days" | CONFLICTS — 1-3 business days; decision is 1 business day from submission. |
| 7 | `app/help/refunds/page.tsx:90` | "Return review takes 3 business days. After approval, refund processing takes 3-5 business days. Depending on your bank, the credit may take 10-14 business days to appear in your account." | CONFLICTS — 3 business days review; decision is 1 business day from submission. |
| 8 | `app/help/refunds/page.tsx:65` | "After vendor receives and inspects item, refund is processed in 3-5 business days. Depending on your bank, the credit may take 10-14 business days to appear in your account." | CONFLICTS (refund timing, not return window) — see section 5. |
| 9 | `lib/support-ai/knowledge-base.ts:22` | "...The vendor reviews requests within 3 business days. Refunds are processed within 3-5 business days after approval..." | CONFLICTS — 3 business days review; decision is 1 business day from submission. |
| 10 | `lib/support-ai/knowledge-base.ts:144` | "...Refunds for approved cancellations are processed within 3-5 business days." | CONFLICTS (refund timing) — see section 5. |
| 11 | `app/faq/faq-client.tsx:73` | "...Refunds are processed within 3-5 business days after approval. Depending on your bank, the credit may take 10-14 business days to appear in your account." | CONFLICTS (refund timing) — see section 5. |
| 12 | `app/help/help-client.tsx:50` | "...Refunds are processed within 3-5 business days after approval. Depending on your bank, the credit may take 10-14 business days to appear in your account." | CONFLICTS (refund timing) — see section 5. |
| 13 | `lib/email.ts:711` | "Refunds typically take 5-10 business days to appear on your original payment method." | CONFLICTS (refund timing) — see section 5. LEGAL (email template on refund page context). |
| 14 | `lib/email.ts:720` | "...Refunds typically take 5-10 business days to appear on your original payment method." | CONFLICTS (refund timing) — see section 5. |
| 15 | `app/refund/page.tsx:157` | "<strong>Refund Processing:</strong> 3-5 business days after approval" | CONFLICTS (refund timing) — see section 5. LEGAL. |
| 16 | `app/refund/page.tsx:161` | "<strong>Credit to Account:</strong> Depending on your bank, may take 10-14 business days" | CONFLICTS (refund timing) — see section 5. LEGAL. |
| 17 | `app/refund/page.tsx:227-230` | "Some vendors may have their own return policies that supplement this platform-wide policy..." | CONFLICTS — defers to vendor-determined policies; decision establishes a single platform return window. LEGAL. |

Also in knowledge-base.ts line 22: "Products may be returned within 3 days of receiving them..." — CONFLICTS (flat 3 days from receiving; decision is from vendor marking completed).

---

## 4. Order modification — NO

No edit-order route or UI exists for modifying an order after placement.

- Grep for `edit.order`, `modify.order`, `change-order`, `order-edit` across `app/`: **no matches**.
- The knowledge-base.ts cancellation response (`lib/support-ai/knowledge-base.ts:140-144`) mentions "modify order" and "edit order" as keywords/patterns but the actual response only discusses cancellation, not modification: "Orders can only be modified or cancelled within 1 hour of placement, and only if they haven't already entered processing or shipping." — this is CONFLICTS vs the cancellation decision (says "1 hour of placement" instead of "1 hour of payment confirmation"; omits GHS 5 fee and no-cancellation-once-shipped).
- No route, page, or component allows a buyer to change items, quantities, or address after an order is placed. The only post-placement actions are cancellation (`app/api/orders/[orderId]/cancel/route.ts`) and return requests (`app/api/returns/route.ts`).

---

## 5. Refund timing — every location, verbatim, CONFLICTS vs draft decision

Draft decision: "once a return is approved, Dhream Market processes the refund within 24 hours; time to reach the buyer's account after that depends on their provider."

All locations below state a different timing and are marked **CONFLICTS** against the draft. Those on `app/refund`, `app/terms`, or `app/payment-policy` are also **LEGAL** (founder must approve exact wording).

| # | File:line | Verbatim | Proposed replacement |
|---|-----------|----------|---------------------|
| 1 | `app/refund/page.tsx:157` | "<strong>Refund Processing:</strong> 3-5 business days after approval" | "Refund Processing: within 24 hours after approval" | LEGAL |
| 2 | `app/refund/page.tsx:161` | "<strong>Credit to Account:</strong> Depending on your bank, may take 10-14 business days" | "Credit to Account: time to reach your account depends on your payment provider" | LEGAL |
| 3 | `app/help/returns/page.tsx:65` | "After vendor receives and inspects item, refund is processed in 3-5 business days. Depending on your bank, the credit may take 10-14 business days to appear in your account." | "After the vendor approves your return, Dhream Market processes the refund within 24 hours. Time to reach your account depends on your provider." |
| 4 | `app/help/returns/page.tsx:90` | "Return review takes 3 business days. After approval, refund processing takes 3-5 business days. Depending on your bank, the credit may take 10-14 business days to appear in your account." | "Return review takes 1 business day. After approval, Dhream Market processes the refund within 24 hours. Time to reach your account depends on your provider." |
| 5 | `app/help/refunds/page.tsx:94` | "Refunds are processed within 3-5 business days after the vendor receives returned items. Depending on your bank, the credit may take 10-14 business days to appear in your account." | "Refunds are processed within 24 hours after the vendor approves the return. Time to reach your account depends on your provider." |
| 6 | `app/help/refunds/page.tsx:68-69` | "- Return Processing: 3-5 business days after receipt" / "- Bank Processing: 10-14 business days for refund to appear" | "- Return Processing: within 24 hours after approval" / "- Bank Processing: depends on your provider" |
| 7 | `app/faq/faq-client.tsx:73` | "...Refunds are processed within 3-5 business days after approval. Depending on your bank, the credit may take 10-14 business days to appear in your account." | "...Refunds are processed within 24 hours after approval. Time to reach your account depends on your payment provider." |
| 8 | `app/help/help-client.tsx:50` | "...Refunds are processed within 3-5 business days after approval. Depending on your bank, the credit may take 10-14 business days to appear in your account." | "...Refunds are processed within 24 hours after approval. Time to reach your account depends on your payment provider." |
| 9 | `lib/support-ai/knowledge-base.ts:22` | "...Refunds are processed within 3-5 business days after approval, credited to your original payment method. Depending on your bank, the credit may take 10-14 business days to appear in your account." | "...Refunds are processed within 24 hours after approval. Time to reach your account depends on your provider." |
| 10 | `lib/support-ai/knowledge-base.ts:144` | "...Refunds for approved cancellations are processed within 3-5 business days." | "...Refunds for approved cancellations are processed within 24 hours." |
| 11 | `lib/email.ts:711` | "Refunds typically take 5-10 business days to appear on your original payment method." | "Refunds are processed within 24 hours after approval. Time to reach your account depends on your provider." |
| 12 | `lib/email.ts:720` | "...Refunds typically take 5-10 business days to appear on your original payment method." | Same as #11. |

No site page, FAQ, email, or knowledge base entry states "24 hours" or "depends on their provider" for refund timing. All current statements are CONFLICTS vs the draft decision.

### Refund flow trace (code)

1. **Vendor approves a return:** `POST /api/vendor/returns/[returnId]/respond/route.ts` → `vendorRespond()` in `lib/returns/return-service.ts:273`. With decision APPROVE, transitions PENDING → AWAITING_REFUND (`lib/returns/state-machine.ts:7`), then calls `requestRefundForReturn()` (line 417).

2. **Who issues the refund:** `requestRefundForReturn()` (line 637) calls `createRefund()` from `lib/refunds/refund-service.ts:271` with `source: 'RETURN'`, `triggeredByRole: 'ADMIN'` (line 715: vendor-approved refunds are triggered as ADMIN by the system, not directly by the vendor). The refund row is created with status PENDING, then Paystack is called via `createPaystackRefund()` (line 515).

3. **Admin manual refund path:** `POST /api/admin/refunds/route.ts:98` — SUPER_ADMIN-only endpoint that calls `createRefund()` with `source: 'MANUAL'`. Requires a client-supplied UUID `requestId` used as the idempotency key. `confirmRefund: true` required.

4. **Other refund triggers:** `app/api/orders/[orderId]/cancel/route.ts` (line 531-595) records a CUSTOMER_CANCEL refund request (no Refund row, no Paystack call — money moves only through `POST /api/admin/refunds`). `app/api/vendor/orders/[orderId]/route.ts` (line 374-398) records a VENDOR_REJECTION refund request similarly.

5. **Reminder / SLA / queue for pending refunds:** No automatic SLA timer, cron, or reminder exists for PENDING refund rows. The only mechanism is:
   - `lib/refunds/refund-service.ts:98` — `STUCK_REFUND_MIN_AGE_MS = 10 * 60 * 1000` (10 minutes): a PENDING refund with no Paystack id becomes eligible for manual resolution after 10 minutes.
   - `app/api/admin/refunds/[id]/check-status/route.ts` — admin can check status, mark failed, or resubmit a stuck refund.
   - `lib/refunds/refund-service.ts:607-609` — `notifyAdminsRefundNeedsChecking()` notifies SUPER_ADMINs when a refund is left in an indeterminate state (timeout, unknown status, ambiguity).
   - No recurring cron processes pending refunds. No escalation SLA beyond the 10-minute manual-resolution gate.

6. **Buyer notifications at each step:**
   - Return opened: best-effort audit log + (vendor notification skipped — `return-service.ts:246-248` has an empty try/catch "notify vendor? need store owner; skip if not available").
   - Vendor approves: refund row created; if order fully settles, `notifyOrderRefunded()` sends one order-level receipt email (`lib/refunds/refund-service.ts:692`); otherwise per-row `notifyRefundProcessed()` sends `sendRefundConfirmationEmail()` (`lib/refunds/refund-email.ts:102`).
   - Email template (`lib/email.ts:684-713`): subject "Refund Processed - Order #..."; body states amount processed and "Refunds typically take 5-10 business days to appear on your original payment method." (CONFLICTS vs draft decision.)
   - Customer is NOT notified when a refund is PENDING/stuck or needs admin review; only SUPER_ADMINs are notified via `notifyAdminsRefundNeedsChecking()`.
   - Order timeline event `REFUNDED` recorded via `recordFulfillmentEvent()` (line 714).

---

## 6. Preorder / backorder cancellation — they go through the same cancel route

`app/api/orders/[orderId]/cancel/route.ts` handles cancellation for all order types including PREORDER and BACKORDER. The route:

- Accepts orders with status PENDING or PROCESSING (line 172, `VALID_CANCEL_STATUSES`).
- Checks `isFulfillmentStageCancellable()` (line 49-62): NORMAL orders always pass; non-NORMAL orders (PREORDER/BACKORDER) must have fulfillmentStatus null or one of PENDING/PROCESSING/AWAITING_STOCK/AWAITING_RESTOCK (lines 37-42). Once a preorder/backorder moves past these stages (e.g. STOCK_RECEIVED, READY_TO_FULFILL, SHIPPED), it cannot be cancelled via this route.
- Checks `order.items.some((item) => item.shippedAt)` (line 214) — if any item shipped, cancellation is rejected.
- Manual orders (`source === 'MANUAL'`) and unpaid orders bypass the cancellation policy entirely: no fee, no counter, no block check (lines 218-250).
- Paid non-manual orders: if the cancellation policy is active (flag + cutover + order created after cutover), applies the 1-hour free window / GHS 5 fee / 4-in-30-days block / wallet restore logic.

### Statuses or order types that bypass the fee or counter

1. **Manual orders** (`order.source === 'MANUAL'`): bypass fee, counter, and block entirely (`lib/orders/[orderId]/cancel/route.ts:223-250`). Also `app/api/vendor/orders/[orderId]/route.ts:314` — manual vendor rejections don't set `vendorRejected` and don't trigger the same refund request path.

2. **Unpaid orders** (`paymentStatus !== 'PAID'`): bypass fee, counter, and block (line 219).

3. **Orders before the cutover timestamp** or when `CANCELLATION_POLICY_ENABLED` is off: the policy is not applied ("today's exact behaviour" — line 255-264).

4. **NORMAL orders**: the `isFulfillmentStageCancellable` check returns `true` unconditionally for NORMAL (line 53-54), but they still go through the fee/counter logic if paid and policy-active. So NORMAL does NOT bypass the fee/counter — it only bypasses the fulfillment-stage check.

5. **PREORDER / BACKORDER**: do NOT inherently bypass the fee or counter. They are subject to the same cancellation policy as NORMAL orders once the policy is active. The only difference is the fulfillment-stage gate: they can be cancelled while awaiting stock/restock, but not after stock has arrived and fulfillment has advanced. If a PREORDER/BACKORDER is paid, not shipped, and within the policy window, the same 1-hour free / GHS 5 fee / counter logic applies.

6. **Vendor rejection path** (`app/api/vendor/orders/[orderId]/route.ts:301-318`): when a vendor rejects an order, it sets status CANCELLED with `vendorRejected: true`. For paid non-manual orders this records a VENDOR_REJECTION refund request (line 384-398) but does NOT go through the customer cancellation counter/block logic. The vendor rejection itself is not subject to the GHS 5 fee or the 4-in-30-days customer block (those apply to customer-initiated cancellations only).

---

## Deliverable summary

**How the return-review deadline is enforced today:** `getVendorResponseHours()` (`lib/feature-flags.ts:25`, default 72 hours from `VENDOR_RESPONSE_HOURS` env) computes `escalationDeadline` stored on the return request (`lib/returns/return-service.ts:172-173`, `prisma/schema.prisma:2613` also has `vendorResponseBusinessDays @default(3)` but it is not used in the deadline computation). When the vendor misses the deadline, no auto-escalation cron exists; a SUPER_ADMIN/SYSTEM must manually call `escalate()` (`lib/returns/return-service.ts:436`) to move PENDING → ESCALATED, then an ADMIN approves or denies. There is no auto-approval, no auto-escalation, and no reminder after the deadline.

**Extra return-window locations found:** 17 locations across `app/refund/page.tsx`, `app/help/returns/page.tsx`, `app/help/refunds/page.tsx`, `app/faq/faq-client.tsx`, `app/help/help-client.tsx`, `lib/support-ai/knowledge-base.ts`, `lib/email.ts` — all state "3 business days" or "1-3 business days" for vendor review or "3-5 business days" / "10-14 business days" / "5-10 business days" for refund processing, conflicting with the 1-business-day review decision and the draft 24-hour refund decision.

**Order modification:** No. No edit-order route or UI exists; only cancellation and return requests are available post-placement.

**Refund timing locations:** 12 locations (site pages, FAQ, help pages, knowledge base, email templates) all state 3-5 business days / 10-14 business days / 5-10 business days, conflicting with the draft 24-hour processing decision. All marked CONFLICTS; those on `app/refund`, `app/terms`, `app/payment-policy` are also LEGAL.

**Preorder/backorder cancellation finding:** They go through `app/api/orders/[orderId]/cancel/route.ts` and the same cancellation policy. They do NOT inherently bypass the fee or counter. Manual orders, unpaid orders, and pre-cutover orders bypass the fee/counter. Vendor rejections also bypass the customer cancellation counter/block but are a separate path.

No files were edited. This addendum is the only new file. STOP.
