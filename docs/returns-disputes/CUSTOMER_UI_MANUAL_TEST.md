# Customer Returns UI — Manual Test Script

Staging only, with `RETURNS_FLOW_ENABLED=true`. Currency is GHS. All screens must be usable on a 360px-wide mobile viewport and variable connections.

## Prerequisites
- Staging environment with `RETURNS_FLOW_ENABLED=true` set.
- Two customer accounts (customer A and customer B) and at least one delivered, paid order item for customer A within the return window (default 7 days from delivery).
- A customer account that is not authenticated (signed out) for redirect checks.

## 1. Flag off → every new URL returns 404
With `RETURNS_FLOW_ENABLED` unset, open each URL while signed in as customer A. Each must return a 404 page and make zero database calls:
- `/dashboard/customer/returns`
- `/dashboard/customer/returns/new?orderItemId=oi_<delivered item>`
- `/dashboard/customer/returns/return_<any id>`
- `/api/returns/eligibility?orderItemId=oi_<delivered item>`

Expected: standard 404, no server-rendered return UI.

## 2. Open a return on a delivered item (happy path)
Signed in as customer A:
1. Go to My Orders → open a delivered order → choose a delivered item → "Return this item" (entry-point link; follow-up, may not exist yet — navigate directly to `/dashboard/customer/returns/new?orderItemId=oi_1`).
2. The new page loads the item summary (name, image, quantity, unit price, maximum refundable amount).
3. The form pre-fills the requested amount at the maximum.
4. Select a reason (e.g. DAMAGED). Quantity only appears when the item quantity > 1.
5. Try submitting a partial amount below the max — it should be accepted.
6. Click "Request Return". The button disables ("Submitting...") while in flight.
7. Success state shows "Return request opened" and links to the new return's detail page.
8. The detail page shows: status badge "Waiting for the seller", description, next step, item summary, reason, requested amount, timeline with the "You opened a return request" event, and a link back to My Returns.

## 3. Partial refund amount
On the new page, change the requested amount to a partial value (e.g. half of max). Submit. Success. On the detail page, the requested amount line reflects the item price (note: `requestedAmount` is not returned by GET /api/returns today; follow-up).

## 4. Window-expired item
Choose a delivered item whose delivery date is more than 7 days ago. Open the new page for it.
Expected: friendly message "The return window for this item has closed." with action "Contact support..." and a link back to the order. Not an error page.

## 5. Duplicate request (OPEN_REQUEST_EXISTS)
With an existing PENDING return for an item, open the new page for the same item again OR resubmit.
Expected: friendly message "You already have an open return request for this item." with action "View it in My Returns." Not an error page.

## 6. Another customer's item
Signed in as customer A, open `/dashboard/customer/returns/new?orderItemId=oi_<customer B's item>`.
Expected: standard 404 page (no hint whether the item exists or belongs to someone else).

Detail page: `/dashboard/customer/returns/return_<customer B's return id>` signed in as customer A → standard 404.

## 7. Mobile width 360px
Open My Returns list, new page, and detail page at 360px width.
- Single column, no horizontal scrolling.
- Tap targets >= 44px (buttons, select, status badge).
- Reason select, amount input, quantity input usable with one thumb.
- "Request Return" button full-width.

## 8. Keyboard-only use
Tab through the new form: reason select → (quantity) → amount input → submit button. Each field shows a visible focus ring. Activate submit with Enter. Inline errors are associated with their fields (`aria-describedby`) and announced to screen readers.

## 9. Screen-reader labels
- Each input has a visible `<label>` linked via `htmlFor`/`id`.
- The status badge has an `aria-label` combining label + description (meaning not colour alone).
- The top error alert uses `role="alert"`.
- Timeline events mark actor (You / Seller / Dhream) and time.

## 10. Authentication redirect
Signed out, open any returns URL. Expected: redirect to `/login?redirect=/dashboard/customer/returns/...`. A non-customer role (vendor) gets 403 on the API route.

## 11. Detail page states
Open each return status via detail page and confirm copy:
- PENDING → "Waiting for the seller" + seller response window note
- ESCALATED → "Under review by Dhream"
- AWAITING_REFUND → "Approved - refund in progress"
- CLOSED → "Completed - refund sent" + refund amount if a processed refund exists
- REJECTED → "Declined"
- ITEM_IN_TRANSIT / ITEM_RECEIVED → "In progress"

## Follow-ups (not part of this UI build)
- Entry-point "Return this item" link on the order detail page (`orders/[id]/page.tsx`) — requires modifying an existing file.
- Free-text description field on opening a return (POST body has none today).
- Attachment upload — the UI deliberately has no file upload.
- Seller/admin notifications when a request is opened or decided.
