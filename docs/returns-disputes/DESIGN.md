# Returns & Disputes Design

## Findings

### ReturnRequest model
- `ReturnRequest`: id, orderItemId (required), customerId (required), status ReturnStatus (default PENDING), reason ReturnReason (required), returnRequired Boolean (default true), quantity Int (default 1), policySnapshot Json (required), escalationDeadline DateTime? (nullable), createdAt, updatedAt. Relations: orderItem, customer, events, attachments, refunds.
- `ReturnRequestEvent`: id, returnRequestId, eventType String, note String?, createdBy String?, createdAt.
- `ReturnRequestAttachment`: id, returnRequestId, url, publicId?, mimeType?, sizeBytes?, createdAt.

### Enums
- `ReturnReason`: NOT_AS_DESCRIBED, DAMAGED, WRONG_ITEM, NOT_RECEIVED, CHANGE_OF_MIND, OTHER.
- `ReturnStatus`: PENDING, ITEM_IN_TRANSIT, ITEM_RECEIVED, AWAITING_REFUND, ESCALATED, REJECTED, CLOSED.
- Open (non-terminal): PENDING, ITEM_IN_TRANSIT, ITEM_RECEIVED, AWAITING_REFUND, ESCALATED.
- Terminal: REJECTED, CLOSED.

### Existing code creating ReturnRequest rows
- None in production. Only schema relations and a super-admin order delete guard reference ReturnRequest. `Refund.returnRequestId` is never populated today.

### createRefund capability
- `createRefund` accepts `source: 'RETURN'` and `returnRequestId`. Idempotency key for RETURN is `RETURN:<reference>` where reference is the returnRequestId. Caps via `Caps.forOrder`. Can refund a partial amount on one order item via `items: [{ orderItemId, amount }]`. No modification needed.

### deliveredAt
- `OrderItem.deliveredAt` is the reliable delivery timestamp. Returnable requires order paymentStatus PAID, order status DELIVERED or COMPLETED, not cancelled, product.isReturnable true, within window, not fully refunded, no open request.

## Transition table

| From | To | Actor | Event |
|---|---|---|---|
| PENDING | AWAITING_REFUND | VENDOR | VENDOR_ACCEPTED |
| PENDING | ESCALATED | VENDOR | VENDOR_REJECTED |
| PENDING | ESCALATED | SYSTEM | ESCALATED (overdue) |
| PENDING | ESCALATED | ADMIN | ESCALATED |
| ESCALATED | AWAITING_REFUND | ADMIN | ADMIN_APPROVED |
| ESCALATED | REJECTED | ADMIN | ADMIN_DENIED |

Terminal states have no outgoing transitions. SYSTEM may only escalate overdue PENDING requests.

## Eligibility
See lib/returns/eligibility.ts. Window boundary inclusive: now <= deliveredAt + windowDays.

## Edge cases
- Duplicate open request: rejected with OPEN_REQUEST_EXISTS.
- Partial quantity: quantity tracked; refund amount capped by Caps.
- Already partially refunded: maxRefundAmount reflects remaining cap.
- Non-returnable product: NOT_RETURNABLE_PRODUCT.
- Delivered more than window ago: WINDOW_EXPIRED.
- Vendor deadline exact boundary: not overdue until now > deadline.
- Admin decision retried after Paystack failure: request stays AWAITING_REFUND; refund step idempotent via RETURN:<returnRequestId>.
- Refund amount above remaining cap: rejected.

## Rollout
- Flag `RETURNS_FLOW_ENABLED` defaults off. Routes return 404 with no DB access.
- No schema changes. Refunds only via createRefund after commit.