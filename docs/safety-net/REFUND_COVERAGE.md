# Refund coverage inventory

What the existing test suite already pins down on the refund money path, and
what it does not. This is a **read-only inventory**: no new refund tests were
written for this step, and no production code was changed.

Files read for this inventory:

| File | Purpose |
| --- | --- |
| `lib/refunds/refund-service.test.ts` | `createRefund` and `checkRefundStatus` |
| `lib/refunds/process-refund.test.ts` | Pure helpers: keys, state machine, wallet guard, caps, pesewa arithmetic |
| `lib/refunds/admin-notify.test.ts` | Admin notifications for a refund request |
| `lib/refunds/refund-email.test.ts` | Per-row refund confirmation email |
| `lib/webhooks/refund-webhook-handler.test.ts` | Paystack refund webhook reconciliation |
| `app/api/admin/refunds/route.test.ts` | `POST/GET /api/admin/refunds` (manual refunds, history) |
| `app/api/admin/refunds/[id]/check-status/route.test.ts` | `POST /api/admin/refunds/<id>/check-status` |
| `app/api/admin/refund-requests/route.test.ts` | `GET /api/admin/refund-requests` (the operator queue) |
| `lib/paystack-refunds.test.ts` | Paystack refund HTTP client (create, list, needs-attention retry) |
| `app/api/webhook/paystack/route.test.ts`, `app/api/payment/webhook/route.test.ts` | Route wiring for the refund webhook |

---

## 1. COVERED - idempotency

| Behaviour | Where it is pinned |
| --- | --- |
| The client `requestId` is the idempotency key verbatim for MANUAL refunds | `process-refund.test.ts` - "returns the client requestId verbatim for a manual refund" |
| Deterministic keys `RETURN:<id>`, `VENDOR_REJECTION:<id>`, `CUSTOMER_CANCEL:<id>` | `process-refund.test.ts` - "builds the deterministic keys for automatic flows" |
| An unknown source is rejected | `process-refund.test.ts` - "rejects an unknown source" |
| A repeated manual `requestId` never issues a second Paystack refund | `refund-service.test.ts` - "never issues a second Paystack refund for the same manual requestId" |
| A replay returns `alreadyProcessed: true` | `app/api/admin/refunds/route.test.ts` - "reports an already processed refund as idempotent" |
| A replay that names a different item is a 409 conflict | `refund-service.test.ts` - "returns 409 when a replay reuses the key for a different order item" |
| A replay that names a different amount is a 409 conflict | `refund-service.test.ts` - "returns 409 when a replay reuses the key for a different amount" |
| A replay that omits the amount is not compared on amount | `refund-service.test.ts` - "does not compare amounts when the request omits one" |
| The same requestId replayed under the lock issues exactly one Paystack call | `refund-service.test.ts` - "still replays the same requestId exactly once with a single Paystack call" |
| A manual refund whose reference is not a UUID is refused | `refund-service.test.ts` - "rejects a manual refund whose key is not a UUID"; `app/api/admin/refunds/route.test.ts` - "requires a requestId" |
| Concurrent refunds serialise on the Payment row lock | `refund-service.test.ts` - "takes the Payment row lock before creating rows", "rejects a request that only the in-transaction refund read can see", "cannot let two different requestIds together exceed the cap" |

## 2. COVERED - retries and stuck rows

| Behaviour | Where it is pinned |
| --- | --- |
| A stuck refund becomes eligible for manual resolution after 10 minutes | `refund-service.test.ts` - "reports the eligibility window before the 10 minute grace period ends"; `refund-service.ts` exports `STUCK_REFUND_MIN_AGE_MS` |
| `MARK_FAILED` is refused before the grace period and honoured after it | `refund-service.test.ts` - "refuses MARK_FAILED before the grace period and marks FAILED afterwards" |
| `MARK_FAILED` on an already settled row is a no-op (`ALREADY_FINAL`) | `refund-service.test.ts` - "is idempotent: MARK_FAILED on an already settled row reports ALREADY_FINAL" |
| `RESUBMIT` re-issues under the same row, under the Payment lock | `refund-service.test.ts` - "resubmits a stuck row under the same record and Payment lock" |
| `RESUBMIT` refuses a row that already carries a Paystack refund id | `refund-service.test.ts` - "refuses to resubmit a row that is already linked to a Paystack refund" |
| A definite Paystack rejection (400/401/403/404/422 with a Paystack message) marks the row FAILED and frees the caps | `refund-service.test.ts` - "marks the row FAILED on a definite Paystack 422 and frees the caps", "marks the row FAILED when Paystack rejects the refund" |
| An indeterminate outcome (timeout, 429, network error, unparseable body, Paystack not configured) leaves the row PENDING and keeps it counting against the caps | `refund-service.test.ts` - "leaves the row PENDING on a timeout and keeps it counting against the caps", "leaves the row PENDING on 429", "leaves the row PENDING on a NETWORK_ERROR", "leaves the row PENDING when the response could not be parsed", "leaves the row PENDING when Paystack is not configured" |
| A timeout cannot be turned into a second Paystack refund | `refund-service.test.ts` - "cannot issue a second Paystack refund for the same amount after a timeout" |
| The admins are told when a refund needs a human | `refund-service.test.ts` - "notifies the admins that an indeterminate refund needs checking"; `refund-webhook-handler.test.ts` - "changes nothing and notifies the admins when the match is ambiguous", "changes nothing and notifies the admins when Paystack reports an unrecognised status" |
| A resubmit that fails is surfaced, never silently marked failed | `refund-service.test.ts` - "surfaces Paystack failures instead of marking the refund failed" |
| The admin endpoint exposes only `MARK_FAILED` / `RESUBMIT` | `app/api/admin/refunds/[id]/check-status/route.test.ts` - "rejects an unknown action", "accepts a lowercase action", "maps a RefundError status from the service" |
| The Paystack-side needs-attention retry call is exercised | `lib/paystack-refunds.test.ts` - the 422 "Refund is not in needs-attention status" case |

## 3. COVERED - NEEDS_ATTENTION

| Behaviour | Where it is pinned |
| --- | --- |
| `needs-attention` and `needs_attention` both map to `NEEDS_ATTENTION` | `process-refund.test.ts` and `refund-webhook-handler.test.ts` - "maps both 'needs-attention' and 'needs_attention' to NEEDS_ATTENTION" |
| `NEEDS_ATTENTION` may advance to PROCESSING / PROCESSED / FAILED | `process-refund.test.ts` - "allows advancing and forbids moving backwards" |
| `NEEDS_ATTENTION` rows are in scope for webhook reconciliation | `refund-webhook-handler.ts` queries `status: { in: ['PENDING', 'PROCESSING', 'NEEDS_ATTENTION'] }` |
| A `NEEDS_ATTENTION` row is not `PROCESSED`, so no customer email goes out | `refund-email.test.ts` - "does not send for a row that is not PROCESSED" |
| A `NEEDS_ATTENTION` refund does not block the operator queue | `app/api/admin/refund-requests/route.ts` comment; the queue test covers FAILED and PENDING explicitly |

## 4. COVERED - webhook handling

`lib/webhooks/refund-webhook-handler.test.ts` covers this thoroughly:

- The signature is verified over the **raw** body before anything else; a missing signature, a signature over anything else, or an unparseable body are each handled ("verifies the signature on the RAW body before anything else", "rejects a missing signature", "rejects a signature computed over anything but the exact raw body", "acknowledges an unparseable body with 200 once the signature is verified").
- The transaction reference is read from `data.transaction_reference` **or** `data.transaction.reference`, and the same `DHV-` reference is used for both the Payment lookup and the Paystack list filter ("does not consult paystackRef for the filter - reference is the source of truth").
- Retryable vs terminal outcomes: 500 on a Payment lookup or reconciliation failure, 502 when the Paystack list cannot be read, 200 for everything that is simply "nothing to do".
- Reconciliation matches by the stored Paystack refund id first, then by amount **and** creation time inside a 60 second window, and only attaches when exactly one candidate matches.
- Ambiguity and unrecognised statuses change nothing and notify the admins. `success` is explicitly *not* treated as PROCESSED.
- Transitions are monotonic - a row is never moved backwards out of a final state.
- The order settles to `REFUNDED` only when the PROCESSED refunds cover the whole payment ("settles the order only when the PROCESSED refunds cover the full payment"); a partial cover leaves the order PAID ("leaves the order PAID when the processed refunds only cover part of the payment").
- Exactly one receipt: "duplicate refund.processed webhook after order is already REFUNDED sends no receipt", "two concurrent settle calls (second sees count 0) produce exactly one receipt", "if receipt email fails, the order stays REFUNDED and no exception escapes".

## 5. COVERED - wallet portion

| Behaviour | Where it is pinned |
| --- | --- |
| An order paid partly or fully with wallet is refused (409) | `process-refund.test.ts` - "refuses an order paid partly or fully with wallet"; `refund-service.test.ts` - "refuses an order paid partly or fully with wallet" |
| No wallet amount, null or undefined is allowed | `process-refund.test.ts` - "allows an order with no wallet amount applied" |
| A wallet-only payment with no Paystack reference is refused | `refund-service.test.ts` - "refuses a wallet-only payment with no Paystack reference" |
| The operator queue flags wallet-assisted orders | `app/api/admin/refund-requests/route.test.ts` - "flags wallet-assisted orders" |
| The manual refund endpoint maps the wallet error to its own status | `app/api/admin/refunds/route.test.ts` - "maps a RefundError to its own status and keeps the other fields returned" (`WALLET_PAYMENT` -> 409) |

## 6. COVERED - caps, amounts and order settlement

- Per-item pro-rated cap and payment-level cap: `process-refund.test.ts` ("apportions the charged amount by the item gross share", "refuses a refund that exceeds the per-item pro-rated share", "refuses a refund total that exceeds the payment-level cap"), `refund-service.test.ts` ("enforces the per-item pro-rated cap", "enforces the payment-level cap across items").
- FAILED refunds do not consume the cap: "ignores failed refunds when computing what is left to refund".
- Integer pesewa arithmetic, so a floating point difference cannot decide a cap: "converts a GHS amount to pesewas without floating point error", "allocates the 0.01 remainder to the last item for an uneven split", "lets a whole-order refund cover the payment exactly and settle the order".
- Amounts with more than two decimal places are refused: "rejects amounts with more than two decimal places".
- One order-level receipt for a whole-order refund vs one email per row for a partial refund: "sends ONE order-level receipt when every item is refunded", "leaves the order PAID and still emails when only part of the payment is refunded", "sends no email while the refund is still in flight".
- MANUAL orders are excluded from platform money flows: "rejects MANUAL orders with a clear error".

---

## 7. NOT COVERED - the two gaps that matter most

### 7.1 There is NO link between a processed refund and VendorBalanceAdjustment

**Nothing in the repository writes or reads a `VendorBalanceAdjustment` row.**
A repository-wide search for `VendorBalanceAdjustment` / `vendorBalanceAdjustment`
returns hits only in `prisma/schema.prisma` (the model and its relations) and
nothing in any `.ts` or `.tsx` file.

Consequences:

- When a refund reaches `PROCESSED`, the vendor's balance is **not** adjusted.
  The money that went back to the customer is not clawed back from what the
  vendor is allowed to withdraw.
- `app/api/vendor/payouts/route.ts` (`getVendorUnpaidEligibleEarnings`) never
  reads the adjustments either, so even a hand-written adjustment row would be
  invisible to the payout eligibility check.
- The `Refund.balanceAdjustments`, `OrderItem.balanceAdjustments`,
  `VendorPayout.balanceAdjustments` and `VendorBalanceAdjustment` relations
  are all declared in the schema and all unused.

This is the gap with no safety net at all: there is no behaviour to
characterize, because there is no code.

### 7.2 There is NO handling of partial refunds in payout eligibility

The eligibility aggregate in `app/api/vendor/payouts/route.ts` is:

```ts
getPrisma().orderItem.aggregate({
  where: {
    product: { storeId: store.id },
    order: {
      paymentStatus: 'PAID',
      status: { in: ['DELIVERED', 'COMPLETED'] },
      source: 'ONLINE',
    },
  },
  _sum: { vendorEarnings: true },
})
```

- A **fully** refunded order stops being eligible, but only by accident: the
  refund flow sets `order.paymentStatus = 'REFUNDED'`, which no longer
  matches `paymentStatus: 'PAID'`. There is no test asserting this.
- A **partially** refunded order keeps `paymentStatus = 'PAID'`, so its full
  `vendorEarnings` still counts towards the payoutable amount. A vendor whose
  order was half refunded can still withdraw the whole vendor share.
- No refund, return, dispute or balance adjustment is consulted anywhere in
  the payout path.

There is no test for any of this because no code implements it. The two
characterization tests added in this task
(`app/api/vendor/payouts/payouts.characterization.test.ts`) pin the current
behaviour and the matching `it.todo`s describe the desired behaviour.

## 8. NOT COVERED - other gaps found while reading

| Gap | Detail |
| --- | --- |
| `Refund.retryCount` / `Refund.lastRetryAt` are never asserted | The resubmit path increments `retryCount` and stamps `lastRetryAt` (`refund-service.ts`), but the existing tests only ever initialise them to `0` in the fake row. Nothing asserts the increment, so the retry counter could stop counting without any test failing. |
| `source: 'RETURN'` is never used in production code | The `RETURN` source and the `RETURN:<returnRequestId>` key are only exercised by the pure key-building unit test. No caller ever creates a refund from a `ReturnRequest`, and `Refund.returnRequestId` is never populated by any caller (`createRefund` accepts the field but nobody passes it). The `ReturnRequest -> Refund` path exists in the schema only. |
| `Refund.walletAmount` is never written | The column defaults to `0` and no code path sets it. The wallet model in `lib/refunds/process-refund.ts` states there is no wallet credit code, and none exists. |
| No test asserts that a fully refunded order drops out of the payout eligibility aggregate | See 7.2. The interaction is incidental, not designed. |
| No test covers `VendorPayoutItem` rows | `VendorPayoutItem` is never written by any code, so there is nothing to test. `app/api/super-admin/orders/[id]/route.ts` refuses to delete an order that "has payout items" (the `hasPayoutItem` guard at line 104), and because no payout item row is ever created, that guard can never fire. The same applies to the `hasBalanceAdjustment` guard on line 109. |
| No test covers the vendor-facing payout views against refund state | `app/api/vendor/payouts/me/route.ts` and `GET /api/vendor/payouts` have no test at all, and neither of them looks at refunds. |
