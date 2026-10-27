# Seller & Admin Returns UI — Manual Test Script

Staging only, with `RETURNS_FLOW_ENABLED=true` and `LEDGER_SHADOW_WRITE=true`. Currency is GHS. All screens must be usable on a 360px-wide mobile viewport.

## Prerequisites
- Staging environment with `RETURNS_FLOW_ENABLED=true`.
- One seller account (VENDOR) owning a store with delivered, paid order items.
- One super admin account.
- At least one customer return request in PENDING state for the seller's item.
- A second seller account for the not-found ownership check.

## 1. Flag off → every new URL returns 404
With `RETURNS_FLOW_ENABLED` unset, open each URL while signed in. Each must return the standard 404 page with zero database calls:
- `/dashboard/vendor/returns`
- `/dashboard/vendor/returns/return_<any id>`
- `/dashboard/admin/returns`
- `/dashboard/admin/returns/return_<any id>`
- `POST /api/admin/return-decisions/<id>/escalate`

## 2. Seller inbox
Signed in as the seller:
1. Open `/dashboard/vendor/returns`. Pending requests appear first.
2. Each row shows item name and image, reason, quantity, reference amount, status badge, time left before the deadline.
3. Empty state appears when the seller has no returns.
4. Mobile width 360px: single column, no horizontal scroll, tap targets >= 44px.

## 3. Seller respond — accept full
1. Open a PENDING return. Item summary, reason, quantity, requested/reference amount, status, deadline shown.
2. Click "Accept and refund". Amount input prefilled at the reference amount.
3. Click "Review refund". Confirmation step shows the exact GHS amount, "refunds the customer now", and "deducted from your earnings".
4. Only the confirmation button sends the request. Buttons disabled in flight.
5. Success shows the new status and a refresh option.

## 4. Seller respond — accept partial
1. Change the amount to a partial value (e.g. half). Submit.
2. Server rejects amounts above the cap with a friendly message.

## 5. Seller respond — reject
1. Click "Reject". Note textarea required with a 500-character limit.
2. Confirmation step shows "Reject this return request. The customer will not be refunded."
3. Submit. Success shows the new status.

## 6. Read-only summary for non-pending
Open a return that is ESCALATED / AWAITING_REFUND / CLOSED / REJECTED. Only the status description and no actions render. No notes are displayed.

## 7. Ownership check
Signed in as seller A, open `/dashboard/vendor/returns/<seller B's return id>`. Standard 404, no hint.

## 8. Admin queue
Signed in as super admin:
1. Open `/dashboard/admin/returns`. Tabs/sections: Needs escalation, Needs decision, Awaiting refund, Ready to close, Done, each with counts.
2. Row: short return id, order reference, item name, reason, quantity, reference amount, status, age, deadline for escalations, linked refund status+amount.

## 9. Admin actions
1. Escalate a PENDING overdue return → POST escalate route → status becomes ESCALATED.
2. Approve an ESCALATED return: amount input prefilled, confirmation with exact GHS amount, POST decision APPROVE.
3. Deny an ESCALATED return: note required, confirmation, POST decision DENY.
4. Close an AWAITING_REFUND return whose refund is PROCESSED → 200 closed.
5. Close refused while refund not PROCESSED → friendly message with refund status and a refresh option.
6. Close with NO_REFUND → friendly message.

## 10. Privacy
- Sellers see no customer name, email, phone or address.
- Admins see the order reference only, no contact details.
- No free-text notes are displayed anywhere.
- No personal data in console output, URLs, analytics or storage.
- No localStorage or sessionStorage usage.

## 11. Keyboard-only and screen reader
- Tab through forms; visible focus rings; submit via Enter.
- Inputs have visible labels linked via htmlFor/id.
- Status badge has an aria-label combining label + description.
- Top error alerts use role="alert".
- Confirmation dialog uses role="dialog" and aria-modal.

## 12. Ledger check (read-only SQL in staging)
Run in staging DB (read-only):
```sql
SELECT * FROM vendor_balance_adjustments WHERE refund_id IN (SELECT id FROM refunds WHERE return_request_id = '<return id>');
```
Confirm a row exists for an accepted return after the refund is PROCESSED.

## Follow-ups
- Navigation links from seller and admin dashboards to the new returns screens.
- Customer/seller/admin notifications.
- Scheduled overdue escalation job (system actor).
- Attachments, description field, requestedAmount persistence (require schema/API changes).
- Exact queue counts beyond the latest 300 fetched requests.
