# Corrective Ledger - design for the dormant vendor refund clawback

Status: **design + dormant foundation only.** Nothing in this document is wired
into a production request path. The ledger records an *open* (unapplied) debit
against a vendor when money is refunded to a customer; the debit carries
forward and will be deducted from the vendor's **next** payout. Deduction from
payouts is explicitly **not** part of this task.

Business rule in one line: **when a customer is refunded, the vendor bears the
cost.**

All money maths in the new code uses `Prisma.Decimal` (decimal.js). No binary
floating point is used on money anywhere in `lib/ledger/`.

**Corrective pass (2026-10-20).** Three corrections are folded into this
document: the foreign-key referential action on the payout relation
(section 7.0), the verification of the two hand-written migrations against
Prisma's own diff (section 7.3), and the switch of the clawback ratio's
denominator from the item gross to the item's **refundable cap**
(section 4.6). Section 8 reconciles the test counts.

---

## 1. Settlement code paths - every place a Refund can become PROCESSED

A `Refund` row is only ever **created** in one place, and its status can only
become `PROCESSED` in four places.

### 1.1 The only writer of `Refund` rows

| File | Function | Line | What it does |
| --- | --- | --- | --- |
| `lib/refunds/refund-service.ts` | `createRefund` | 449-463 | `tx.refund.create(...)` with `status: 'PENDING'`. One row **per order item**. |

`createRefund` fans out to one `Refund` row per requested order item
(`lib/refunds/refund-service.ts:333-337`, `:431-478`). The `Refund` row is
therefore **always** attached to exactly one `OrderItem`
(`Refund.orderItemId` is `NOT NULL`, `prisma/schema.prisma:2558`).

Callers of `createRefund` in production code - only one:

| Entry point | Call |
| --- | --- |
| `app/api/admin/refunds/route.ts` | `POST` -> `createRefund({ source: 'MANUAL', reference: requestId, ... })` at line 98 |

The other three `RefundSource` values are **not** wired to any production
refund today:

* `RETURN` - never used (`Refund.returnRequestId` is never populated).
* `VENDOR_REJECTION` - `app/api/vendor/orders/[orderId]/route.ts:358,369` only
  writes an audit-log `source` string; it creates no `Refund` row and makes no
  Paystack call.
* `CUSTOMER_CANCEL` - `app/api/orders/[orderId]/cancel/route.ts:307,333` is a
  *pending-approval refund request*: it deliberately creates no `Refund` row
  (the comment at lines 292-296 explains that a `Refund` row would consume the
  item's refundable cap and block the super admin's approval). The super admin
  later issues the real refund through `POST /api/admin/refunds`.

### 1.2 The four transitions into `PROCESSED`

All four derive the new status from the single mapper
`mapPaystackRefundStatus` (`lib/refunds/process-refund.ts:118-133`), which
maps the Paystack string `processed` (case-insensitive, trimmed) to
`PROCESSED`. Paystack's `success` is deliberately **not** mapped to
`PROCESSED`.

| # | File | Function | Line(s) | Trigger |
| --- | --- | --- | --- | --- |
| 1 | `lib/refunds/refund-service.ts` | `createRefund` | 564-572 | The Paystack refund-create call returned `success` and a known status, and that status was `processed`. |
| 2 | `lib/refunds/refund-service.ts` | `checkRefundStatus` (reconcile branch) | 855-871 | The admin "check status" endpoint matched exactly one Paystack refund for the row. |
| 3 | `lib/refunds/refund-service.ts` | `checkRefundStatus` (`RESUBMIT` branch) | 1119-1130 | An admin resubmitted a stuck row and Paystack answered `processed`. |
| 4 | `lib/webhooks/refund-webhook-handler.ts` | `reconcileRefundsForPayment` | 177-185 | The Paystack `refund.*` webhook reconciled the row against Paystack's authoritative refund list. |

Entry points that reach them:

| Entry point | Reaches |
| --- | --- |
| `app/api/admin/refunds/route.ts` `POST` | path 1 |
| `app/api/admin/refunds/[id]/check-status/route.ts` `POST` (line 82 calls `checkRefundStatus`) | paths 2 and 3 |
| `app/api/webhook/paystack/route.ts` `POST` (line 158-163 -> `handleRefundWebhook`) | path 4 |

**Consequence for the ledger:** a refund can reach `PROCESSED` from four
different places, and the same refund can be reconciled repeatedly (the
webhook and the admin endpoint can both see it). Any ledger write keyed on the
refund therefore **must** be idempotent - see section 5.

---

## 2. What `Refund.amount` and `Refund.walletAmount` mean

| Column | Type | Meaning |
| --- | --- | --- |
| `Refund.amount` | `Decimal(12,2)` | **The money returned to the customer for this order item**, in GHS. It is the amount that went to Paystack as a refund. |
| `Refund.walletAmount` | `Decimal(12,2)`, default `0` | The (never used) portion of the refund that would have been returned to the customer's wallet balance instead of to the card. |

Findings:

* **The customer receives `amount` in total.** `walletAmount` is a *split* of
  `amount` in the wallet model, not an addition. There is no wallet-credit
  code in the repository at all - `lib/refunds/process-refund.ts:13-16` states
  it, and `processRefund` refuses any order with `walletAmountApplied > 0`
  (HTTP 409, `guardWalletOrder`, `lib/refunds/process-refund.ts:276-284`).
* **`Refund.walletAmount` is never written.** No code path sets it; the column
  default `0` is what every row carries. It is `0` in every row that exists
  today and in every row that can exist today.
* `Refund.amount` is **per order item**, not per order and not per unit. A
  `Refund` row belongs to one `OrderItem`; there is no `quantity` column on
  `Refund`, so a refund of "2 of 3 units" is expressed as a *money amount*
  against the item line, not as a unit count.
* **Partial refunds of a multi-quantity item are possible and normal.** The
  admin endpoint accepts an explicit per-item amount
  (`app/api/admin/refunds/route.ts:71-96` -> `RefundItemInput.amount`), and
  `Caps.validate` refuses only amounts *above* the item's remaining cap
  (`lib/refunds/process-refund.ts:347-360`). `Caps.forOrder` computes the
  per-item cap as the item's pro-rata share of the charged payment
  (`lib/refunds/process-refund.ts:377-430`).
* The refund amount is exact to the pesewa: `Caps.validate` refuses any amount
  with more than two decimal places (`lib/refunds/process-refund.ts:333-339`),
  and `toPesewas` does the conversion in `Prisma.Decimal`, never in float
  (`lib/refunds/process-refund.ts:199-205`).

**Decision for the ledger:** the clawback base is `Refund.amount` only.
`walletAmount` is always `0` and is not added to the base. (If a future
wallet-refund path ever populates it, `amount` would still be the total
returned to the customer, so the base stays `amount`.)

---

## 3. How the order-item money fields are computed, and the exact identity

### 3.1 Where the fields are written

Two live checkout paths write the `OrderItem` money fields, and they are
identical in shape:

| Path | Lines |
| --- | --- |
| `app/api/payment/verify/route.ts` (payment verification) | 204-271 |
| `lib/webhooks/order-webhook-handler.ts` (payment webhook) | 175-238 |

A third path backfills them for historical orders:
`scripts/backfill-order-commission.ts:33-77`.

### 3.2 The computation

```ts
// app/api/payment/verify/route.ts:221-234 and
// lib/webhooks/order-webhook-handler.ts:190-202
let grossAmount = 0
for (const item of orderItems) grossAmount += item.price * item.quantity
const actualChargedAmount = paystackResponse.data.amount / 100
const processorFee = Math.max(0, Math.round((actualChargedAmount - grossAmount) * 100) / 100)
const financialBreakdown = await calculateFinancialBreakdown(grossAmount, 0)
```

```ts
// app/api/payment/verify/route.ts:250-271
for (const item of orderItems) {
  const itemGross = item.price * item.quantity
  const itemProcessorFee = Math.round((itemGross / grossAmount) * processorFee * 100) / 100
  const itemFinancialBreakdown = await calculateFinancialBreakdown(itemGross, 0)
  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      grossAmount:       itemFinancialBreakdown.grossAmount,
      processorFee:      itemProcessorFee,
      netAmount:         itemFinancialBreakdown.netAmount,
      platformCommission: itemFinancialBreakdown.platformCommission,
      vendorEarnings:    itemFinancialBreakdown.vendorEarnings,
      commissionRate:    itemFinancialBreakdown.commissionRate,
    },
  })
}
```

`calculateFinancialBreakdown` (`lib/revenue.ts:78-96`):

```ts
const rate            = commissionRate ?? await getCommissionRate()
const netAmount       = processorFee !== null ? grossAmount - processorFee : null
const platformCommission = grossAmount * rate
const vendorEarnings  = netAmount !== null ? netAmount - platformCommission : null
```

### 3.3 The exact identity

For every **ONLINE** order item written by the two live checkout paths:

```
OrderItem.grossAmount        = price * quantity                 (exact)
OrderItem.netAmount          = grossAmount - 0                  = grossAmount
OrderItem.platformCommission = grossAmount * commissionRate
OrderItem.vendorEarnings     = netAmount - platformCommission
                             = grossAmount * (1 - commissionRate)
```

i.e. **`vendorEarnings = netAmount - platformCommission`**, and because the
processor fee is passed into the breakdown as `0` (the fee is a pass-through
charged to the customer, `app/api/checkout/route.ts:139-141`), the item's
`netAmount` equals the item's `grossAmount` and the fee is **not** deducted
from the vendor's earnings.

`OrderItem.processorFee` is stored as the item's *pro-rata share of the real
Paystack fee* and therefore does **not** satisfy
`netAmount = grossAmount - processorFee` on the item row. The identity that
holds is the one above, on the values the breakdown was computed from.

The backfill script (`scripts/backfill-order-commission.ts:38-71`) differs: it
passes the *real* processor fee into the breakdown, so for rows it wrote
`vendorEarnings = grossAmount - processorFee - platformCommission`. Both forms
satisfy the general identity `vendorEarnings = netAmount - platformCommission`
for the net amount that was used, and both keep `grossAmount = price *
quantity`.

**Decision for the ledger:** the clawback is proportional to the *item's own*
`vendorEarnings` and `grossAmount` snapshots, so the ledger does not need to
re-derive the commission: it only needs the ratio
`vendorEarnings / grossAmount` that the checkout already froze on the item.

### 3.4 Is `grossAmount` reliable?

* For ONLINE orders: **yes**. Both live checkout paths set it to
  `price * quantity`, and the backfill script does the same.
* For MANUAL orders: it is `NULL` (`app/api/vendor/manual-orders/route.ts:350`).
  This does not matter, because `createRefund` refuses MANUAL orders outright
  (`lib/refunds/refund-service.ts:280-282`), so no refund - and therefore no
  clawback - can ever exist for a MANUAL order.
* It is `Float`, so it carries binary float noise (`price * quantity` for
  `33.33 * 3` is `99.99000000000001`). The ledger normalises every Float input
  with `new Prisma.Decimal(String(value)).toDecimalPlaces(2, ROUND_HALF_UP)`
  before doing any arithmetic. `100.00` and `99.99000000000001` therefore
  become the same two-decimal value.
* `vendorEarnings` is `Float` too and carries the same kind of noise
  (`100 - 100 * 0.01` is `99.00000000000001`). Same normalisation.

### 3.5 A note on the refund cap vs the item gross

The **refundable cap** of an item is not the item's gross. `Caps.forOrder`
allocates the *charged payment amount* across the items pro-rata to their
gross, with the rounding remainder on the last item
(`lib/refunds/process-refund.ts:222-253`, `:384-430`):

```
itemCap = share of Payment.amount
Payment.amount = chargeTotal = subtotal + pass-through processing fee
                 (app/api/checkout/route.ts:139-141, :297-306)
                 ~= subtotal * 1.0199   (PAYSTACK_FEE_PERCENTAGE = 0.0195)
```

So an item's refundable cap is about **1.99 % larger** than its gross, and a
"full" refund of an item therefore refunds slightly more than the item is
worth (the customer also gets the pass-through fee back). The clawback
formula must therefore clamp at the item's vendor earnings - see section 4.

**Decision for the ledger (corrective pass, 2026-10-20):** the denominator of
the clawback ratio is the item's **refundable cap**, not the item gross. The
cap is obtained by reusing `Caps.forOrder` - the very same pure function the
refund service uses to build the cap it enforces - so the ledger's
denominator and the refund service's limit can never drift apart. See
section 4.6.

---

## 4. The formula

### 4.1 Vocabulary

For one order item and one refund:

| Symbol | Meaning | Source |
| --- | --- | --- |
| `CAP` | the item's **refundable cap**: its pro-rata share of the charged payment | `Caps.forOrder(order).itemCap(orderItemId)` (`lib/refunds/process-refund.ts:377-430`) |
| `G` | item gross | `OrderItem.grossAmount` (normalised to 2 dp) - **no longer used by the formula** |
| `E` | item vendor earnings | `OrderItem.vendorEarnings` (normalised to 2 dp) |
| `R` | value refunded by *this* refund | `Refund.amount` (already `Decimal(12,2)`) |
| `R0` | value refunded on this item *before* this refund | sum of `Refund.amount` over the item's already-`PROCESSED` refunds, excluding this refund |
| `C0` | magnitude already clawed back for this item | sum of the absolute amounts of this item's existing `REFUND_CLAWBACK` entries |

### 4.2 Sign convention

* The ledger stores the debit as a **negative** amount (`amount < 0`). A
  positive `VendorBalanceAdjustment.amount` is money paid *to* the vendor; a
  negative amount is money withheld *from* the vendor.
* `computeVendorClawback` therefore returns a value that is **zero or
  negative**. Zero means "nothing to claw back for this refund".
* `alreadyClawedBack` (`C0`) is passed around as a **positive magnitude** (the
  sum of the absolute values of the previous debits), because that is what
  the subtraction below needs.

### 4.3 The formula

```
cumulative  = R0 + R                      (the value refunded on this item, including this refund)
ratio       = cumulative / CAP
target      = ratio >= 1
                 ? E                        (exactly the remaining earnings, no rounding drift)
                 : round2(E * ratio)       (half-up)
debit       = max(0, target - C0)        (a positive magnitude)
result      = -debit                     (zero or negative)
```

`round2` is `Prisma.Decimal#toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)`.

Why the clamp at `ratio >= 1` matters: the cumulative refund on a fully
refunded item reaches the item's refundable cap, which is ~1.99 % larger than
the gross (section 3.5), so `ratio >= 1` is what a *full* refund looks like.
Clamping to `E` is exactly the right end state - a fully refunded item must
leave the vendor with nothing for that item - and it is also what makes the
lifetime total land on `E` with zero rounding drift.

### 4.4 Why the lifetime total never drifts

`target` is a **monotonically non-decreasing** function of `cumulative`, and
`cumulative` only grows as refunds are processed. Each debit is
`target(cumulative) - C0`, and `C0` is the sum of the previous debits, which
equals the previous `target`. So the debits are the successive differences of
a non-decreasing sequence bounded above by `E`:

```
sum of all debits for the item = target(final cumulative) <= E
```

and when the item is fully refunded, `target(final cumulative) = E` exactly.
The intermediate rounding to 2 dp never accumulates, because each debit is
computed against the *cumulative* value, not against the previous debit.

Worked example (the awkward one from the task):

```
CAP = 102.00, E = 91.37
refund 1: R = 33.33 -> cumulative  33.33 -> target 29.86 -> debit 29.86
refund 2: R = 33.33 -> cumulative  66.66 -> target 59.71 -> debit 59.71 - 29.86 = 29.85
refund 3: R = 33.34 -> cumulative 100.00 -> target 89.58 -> debit 89.58 - 59.71 = 29.87
total = 29.86 + 29.85 + 29.87 = 89.58          (the proportional target, exactly)
```

The same three refunds, but now summing to the whole cap:

```
CAP = 102.00, E = 91.37
refund 1: R = 34.00 -> cumulative  34.00 -> ratio 1/3     -> target 30.46 -> debit 30.46
refund 2: R = 34.00 -> cumulative  68.00 -> ratio 2/3     -> target 60.91 -> debit 60.91 - 30.46 = 30.45
refund 3: R = 34.00 -> cumulative 102.00 -> ratio >= 1     -> target 91.37 -> debit 91.37 - 60.91 = 30.46
total = 30.46 + 30.45 + 30.46 = 91.37 = E                 (exactly, no drift)
```

### 4.5 Edge cases

| Case | Behaviour | Why |
| --- | --- | --- |
| `E` is `null` (no earnings snapshot) | **zero**, no debit | There is no vendor earnings to claw back. The service reports `skipped` with a reason. |
| `E` is `0` | zero | Nothing to claw back. |
| `E` is negative | zero | Nothing sensible to claw back; the platform's loss is a different problem. |
| `CAP` is `null`/`0`/negative | zero | There is no base to be proportional to. The service never gets here: it reports `skipped` with reason `REFUNDABLE_CAP_UNKNOWN` before calling the calculator. |
| `R <= 0` | zero | This refund returned no money, so it costs the platform nothing. |
| `R0 < 0` | **throw** `ClawbackInputError` | A sum of refund amounts can never be negative: this is a caller bug, not a business case. |
| `C0 < 0` | **throw** `ClawbackInputError` | `alreadyClawedBack` is defined as a positive magnitude. |
| any input is `NaN` or `±Infinity` | **throw** `ClawbackInputError` | Never guess at a broken number. |
| `C0 > target` | debit `0` | The result must never be positive. Clamped. |
| over-refund (`cumulative > CAP`) | debit capped at the remaining `E` | The lifetime total can never exceed `E`. |
| multiple partial refunds | handled by the cumulative formula | See 4.4. |
| rounding remainder | none - the target is recomputed from the cumulative every time | See 4.4. |

**Spec ambiguity and how it was resolved.** The task specification says both
"return zero when vendorEarnings is null/zero/negative, when itemGross is zero
or invalid, or when refundedValue is zero or negative" and "reject (throw a
typed error) NaN, Infinity or negative inputs". Those two rules overlap on
"negative". Resolution used here, and asserted in the tests:

* The **enumerated** zero cases are implemented as zero (they are business
  no-ops, not guesses): `vendorEarnings` null/zero/negative, the refundable
  cap null/zero/negative, `refundedValue` zero/negative.
* **Everything that is not enumerated** and cannot be a legitimate value is
  rejected with a typed error: `NaN`/`Infinity` on any input, and a negative
  `alreadyRefundedValueBefore` or `alreadyClawedBack`.

### 4.6 The denominator is the refundable cap (corrected)

The **earlier** version of this document recorded the gross-based ratio as a
known, deliberate deviation and recommended switching to the cap before the
ledger was wired to any production path. **That switch has been made.**

* **Route taken: REUSE, not replication.** The refund service computes an
  item's refundable cap through `Caps.forOrder(order).itemCap(orderItemId)`
  (`lib/refunds/refund-service.ts:304`), and `Caps` is an **exported class
  with a pure static factory** (`lib/refunds/process-refund.ts:295-430`). It
  performs no database access: it takes the order shape as an argument and
  returns the caps. It is therefore reusable as-is, and
  `lib/ledger/corrective-ledger.ts` now imports it
  (`import { Caps } from '@/lib/refunds/process-refund'`).

  Reusing it is strictly better than replicating the arithmetic: the ledger's
  denominator is then *by construction* the same number the refund service
  refused to exceed, so the two can never drift apart. The replication route
  (re-implement the pro-rata allocation in `lib/ledger` with `Prisma.Decimal`
  and add an equivalence test) would have introduced a second implementation
  of a rule that already has one.

* **What the ledger reads to build the cap.** `Caps.forOrder` allocates the
  *charged payment* across the order's items in proportion to their gross,
  with the integer-pesewa rounding remainder on the **last** item
  (`lib/refunds/process-refund.ts:222-253`). The ledger therefore reads the
  whole order's items (`id`, `price`, `quantity`) and the order's payment
  (`id`, `amount`) alongside the refunded item, and passes them to
  `Caps.forOrder` unchanged - the same shape `refund-service.ts` passes
  (`orderInclude`, `lib/refunds/refund-service.ts:258-263`).

  The item order is not sorted by the ledger, for the same reason the refund
  service does not sort it: the remainder must land on the same item in both
  places, so both must see the items in the same order.

* **When the cap cannot be determined** (no order, no payment, or a
  non-positive cap), the ledger returns `skipped` with reason
  `REFUNDABLE_CAP_UNKNOWN` and writes nothing. It never falls back to the
  gross, and it never guesses.

* **The new formula:**

  ```
  target = cumulative >= CAP ? E : round2(E * cumulative / CAP)
  ```

  The worked example from the task: `G = 100.00`, `E = 99.00`,
  `CAP = 102.00`, a refund of `51.00`.

  | Formula | Result |
  | --- | --- |
  | cap-based (**now used**) | `99.00 * 51 / 102 = 49.50` |
  | gross-based (removed) | `99.00 * 51 / 100 = 50.49` |

  A difference of 0.99 - 2 % of the debit - in the vendor's favour. At a
  *full* refund the two formulas agree, because both clamp at `E`.

* **What did NOT change.** Every other rule is untouched: zero for null or
  zero earnings, never a positive result, never a lifetime total above the
  vendor's earnings, and a typed `ClawbackInputError` for `NaN`, `Infinity`
  or a negative history.

---

## 5. Idempotency

### 5.1 The key

```
idempotencyKey = 'refund-clawback:' + refundId
```

e.g. `refund-clawback:cust123`.

* It is derived from the **refund id**, which is a stable, immutable
  identifier of exactly one refund. It is not derived from a count of existing
  refunds, a timestamp or a hash of the amount, so it can never collide with
  a different refund and can never change.
* The column is `String?` with a `@unique` constraint, so the database
  enforces it. The unique index is created by the migration
  `20261020110000_corrective_ledger_refund_clawback_columns`.

### 5.2 The three outcomes of `recordRefundClawback`

| Status | When |
| --- | --- |
| `created` | A new `VendorBalanceAdjustment` was written. |
| `already_recorded` | A row with this idempotency key already exists - either found on the pre-read, or the `create` lost a race and raised `P2002` on the unique index. |
| `skipped` | There is nothing to do: the refund is not `PROCESSED`, the store/vendor cannot be resolved, `vendorEarnings` is null, or the item's refundable cap cannot be determined. `reason` says which. |

The function **never throws** for "nothing to do". It throws only for genuine
programming errors (an unknown Prisma error that is not `P2002`).

### 5.3 The race

Two concurrent calls for the same refund can both pass the pre-read and both
try to create. The second one gets Prisma error `P2002` (unique constraint
violation on `idempotencyKey`). That is caught and treated as
`already_recorded`: the existing row is read back and returned. The unique
index is the real guard; the pre-read is only a fast path.

---

## 6. What the ledger writes

```ts
VendorBalanceAdjustment {
  vendorId,        // Store.userId of the item's product store
  storeId,         // the item's product store id
  appliedPayoutId: null,      // OPEN: not yet deducted from a payout
  appliedAt:       null,      // OPEN: not yet deducted from a payout
  orderItemId,     // the refunded order item
  refundId,        // the refund that caused the debit
  adjustmentType:  'REFUND_CLAWBACK',
  amount:          negative Decimal(12,2),
  note:            'Vendor refund clawback for refund <refundId> (order item <orderItemId>).'
  currency:        'GHS'
}
```

* The note contains **ids only**. `Refund.reason` is free text typed by an
  admin and may contain customer data, so it is **not** copied into the note.
* The note is deterministic - it contains no timestamp - so two calls that
  race produce byte-identical rows.
* `vendorId` is `Store.userId`: the vendor who owns the store
  (`prisma/schema.prisma:156-160`; `Store.userId` is unique and points at the
  vendor `User`). This is the same identity the payout path uses
  (`app/api/vendor/payouts/route.ts:340-348` looks the store up by `userId`).
* The ledger is **append-only** in this task. No function that updates or
  deletes an entry is exported. Deduction from a payout - which would set
  `appliedPayoutId` and `appliedAt` - is a later task.

---

## 7. The schema change

`prisma/schema.prisma`, model `VendorBalanceAdjustment` (lines 2658-2684) and
enum `AdjustmentType` (lines 3199-3204), and nothing else:

| Change | Why |
| --- | --- |
| `appliedPayoutId String?` (was `String`) | An open debit has no payout yet. |
| `payout` relation becomes optional | Follows the column. |
| `appliedAt DateTime?` (was `DateTime`) | An open debit has not been applied yet. |
| `idempotencyKey String?` `@unique` | The idempotency guard. Nullable because the table already exists with rows and the migration must not rewrite data. |
| `currency String @default("GHS")` | The ledger is multi-currency capable from day one; the only currency in use today is GHS. |
| `@@index([storeId, appliedPayoutId])` | Supports "open debits for a store". |
| `AdjustmentType.REFUND_CLAWBACK` | The new adjustment kind. |

No back-relation is added or changed: `Refund.balanceAdjustments`,
`OrderItem.balanceAdjustments` and `Store.vendorBalanceAdjustments` already
exist and already point at this model, and `VendorPayout.balanceAdjustments`
already exists. Making the payout relation optional does not change any
back-relation.

### 7.0 The foreign-key referential action (corrected)

Making the `payout` relation **optional** changes Prisma's default referential
action for it. For a **required** relation Prisma defaults to `Restrict`;
for an **optional** relation it defaults to `SetNull`. The database, however,
already carries the constraint that was created with the *required* relation:

```sql
-- prisma/migrations/20261008010000_add_returns_refunds_payout_ledger/migration.sql:179
ALTER TABLE "vendor_balance_adjustments"
  ADD CONSTRAINT "vendor_balance_adjustments_appliedPayoutId_fkey"
  FOREIGN KEY ("appliedPayoutId") REFERENCES "vendor_payouts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

So the hand-written schema change would have left the datamodel claiming
`SetNull` while the database enforced `Restrict` - **drift**. Prisma's own
diff proves it (the exact command and output are in section 7.3):

```sql
-- DropForeignKey
ALTER TABLE "vendor_balance_adjustments" DROP CONSTRAINT "vendor_balance_adjustments_appliedPayoutId_fkey";
-- AddForeignKey
ALTER TABLE "vendor_balance_adjustments" ADD CONSTRAINT "vendor_balance_adjustments_appliedPayoutId_fkey"
  FOREIGN KEY ("appliedPayoutId") REFERENCES "vendor_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

`SetNull` would be actively dangerous here: deleting a payout would silently
set `appliedPayoutId` to `NULL`, which is exactly the marker the ledger uses
for an **open** debit - an applied debit would be re-opened and would be
deducted from the vendor's next payout a second time.

**Fix:** `onDelete: Restrict` is now stated explicitly on the relation, which
pins the datamodel to the constraint the database already has:

```prisma
payout          VendorPayout?  @relation(fields: [appliedPayoutId], references: [id], onDelete: Restrict)
```

This is the same idiom the schema already uses for the three optional
relations on `Refund` (`prisma/schema.prisma:2579-2581`):
`onDelete: Restrict` on an optional relation means "a referenced row may not
be deleted while a reference to it exists" - which is precisely the
constraint the database already enforces.

With the fix in place, Prisma's diff of the old schema against the new one
contains **no foreign-key statement at all**.

### 7.1 The two migrations

The migrations are **hand written**; `prisma migrate dev` was never run.

| Directory | Contents |
| --- | --- |
| `prisma/migrations/20261020100000_corrective_ledger_refund_clawback_enum/migration.sql` | `ALTER TYPE "AdjustmentType" ADD VALUE IF NOT EXISTS 'REFUND_CLAWBACK';` **and nothing else.** |
| `prisma/migrations/20261020110000_corrective_ledger_refund_clawback_columns/migration.sql` | `ALTER TABLE ... DROP NOT NULL` x2, `ADD COLUMN` x3, `CREATE UNIQUE INDEX`, `CREATE INDEX`. |

They are split because PostgreSQL cannot use a new enum value in the same
transaction that adds it (until PostgreSQL 12, and even then only if the
transaction does not use the value - Prisma's migrate runs each migration in
its own transaction, so the value is only *usable* from the next migration
on). Keeping the enum change alone means the column migration can safely
insert rows with the new value.

Every statement in both files is **additive or relaxing**:

* `ALTER TYPE ... ADD VALUE IF NOT EXISTS` - additive.
* `ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL` - relaxing.
* `ALTER TABLE ... ADD COLUMN ...` - additive.
* `CREATE UNIQUE INDEX` / `CREATE INDEX` - additive.

There is **no** `DROP`, no data rewrite, no table rewrite, no
`DELETE`/`UPDATE`, and no `SET NOT NULL`.

### 7.2 Rollback notes (by hand)

Both migrations are reversible by hand, in this order.

**Rollback of the column migration** (`..._columns`):

```sql
-- 1. Drop the index created by this migration (it is a plain index, safe to drop).
DROP INDEX IF EXISTS "vendor_balance_adjustments_storeId_appliedPayoutId_idx";
DROP INDEX IF EXISTS "vendor_balance_adjustments_idempotencyKey_key";

-- 2. Remove any row that carries the new idempotency key, if the ledger was
--    ever activated (it is dormant, so this should find nothing).
--    Do this BEFORE the next statement: a NOT NULL column cannot be restored
--    while rows have a NULL value.
DELETE FROM "vendor_balance_adjustments" WHERE "idempotencyKey" IS NOT NULL;

-- 3. Drop the added columns.
ALTER TABLE "vendor_balance_adjustments" DROP COLUMN "idempotencyKey";
ALTER TABLE "vendor_balance_adjustments" DROP COLUMN "currency";

-- 4. Restore NOT NULL on the two relaxed columns.
--    (Only safe once every row has a non-null value again - which the
--    dormant ledger guarantees, because no row is ever created with a NULL
--    appliedPayoutId.)
ALTER TABLE "vendor_balance_adjustments" ALTER COLUMN "appliedPayoutId" SET NOT NULL;
ALTER TABLE "vendor_balance_adjustments" ALTER COLUMN "appliedAt" SET NOT NULL;
```

**Rollback of the enum migration** (`..._enum`): PostgreSQL cannot remove a
value from an enum type. The value is simply left in place, unused. To remove
it you have to recreate the type, which is a full table rewrite and is **not
recommended**:

```sql
-- NOT RECOMMENDED. Only if the value really must disappear.
-- 1. Create the type without the value.
CREATE TYPE "AdjustmentType_new" AS ENUM ('CHARGEBACK', 'FEE_CORRECTION', 'MANUAL');
-- 2. Move the data across (the column type must be changed first).
ALTER TABLE "vendor_balance_adjustments" ALTER COLUMN "adjustmentType" DROP DEFAULT;
ALTER TABLE "vendor_balance_adjustments"
  ALTER COLUMN "adjustmentType" TYPE "AdjustmentType_new"
  USING ("adjustmentType"::text::"AdjustmentType_new");
-- 3. Drop the old type and rename.
DROP TYPE "AdjustmentType";
ALTER TYPE "AdjustmentType_new" RENAME TO "AdjustmentType";
```

Because the ledger is dormant, **no row can carry `REFUND_CLAWBACK`**, so the
recommendation is: leave the enum value in place and simply stop using it.

### 7.3 Migration verification

The two hand-written migrations were checked against the SQL Prisma itself
generates for the same schema change. **No database was involved** and
`prisma migrate` was never run: the diff is computed from two schema
datamodels.

**The command** (Prisma 7.6.0 renamed `--from-schema-datamodel` to
`--from-schema`; the flag in the task description no longer exists and the
CLI rejects it):

```
git show HEAD:prisma/schema.prisma > /tmp/old-schema.prisma
npx prisma migrate diff \
  --from-schema /tmp/old-schema.prisma \
  --to-schema   prisma/schema.prisma \
  --script
```

`HEAD:prisma/schema.prisma` is the right "before" side: the two new
migrations are untracked, so the schema the committed migration history
produces in the database is exactly the schema at `HEAD`.

**Prisma's generated SQL:**

```sql
-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE 'REFUND_CLAWBACK';

-- AlterTable
ALTER TABLE "vendor_balance_adjustments" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GHS',
ADD COLUMN     "idempotencyKey" TEXT,
ALTER COLUMN "appliedPayoutId" DROP NOT NULL,
ALTER COLUMN "appliedAt" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "vendor_balance_adjustments_idempotencyKey_key" ON "vendor_balance_adjustments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "vendor_balance_adjustments_storeId_appliedPayoutId_idx" ON "vendor_balance_adjustments"("storeId", "appliedPayoutId");
```

**Statement-by-statement comparison with the hand-written files:**

| Operation | Prisma | Hand-written | Verdict |
| --- | --- | --- | --- |
| Enum value | `ALTER TYPE "AdjustmentType" ADD VALUE 'REFUND_CLAWBACK'` | `ALTER TYPE "AdjustmentType" ADD VALUE IF NOT EXISTS 'REFUND_CLAWBACK'` | **Same operation.** The hand-written form adds `IF NOT EXISTS`, which makes the statement idempotent (re-running it is a no-op instead of an error). Strictly safer; still additive. **Kept as is.** |
| `currency` column | `ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GHS'` | `ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GHS'` | **Identical.** |
| `idempotencyKey` column | `ADD COLUMN "idempotencyKey" TEXT` | `ADD COLUMN "idempotencyKey" TEXT` | **Identical.** |
| `appliedPayoutId` | `ALTER COLUMN "appliedPayoutId" DROP NOT NULL` | `ALTER COLUMN "appliedPayoutId" DROP NOT NULL` | **Identical.** |
| `appliedAt` | `ALTER COLUMN "appliedAt" DROP NOT NULL` | `ALTER COLUMN "appliedAt" DROP NOT NULL` | **Identical.** |
| Unique index | `CREATE UNIQUE INDEX "vendor_balance_adjustments_idempotencyKey_key" ON "vendor_balance_adjustments"("idempotencyKey")` | identical, same index name | **Identical.** |
| Composite index | `CREATE INDEX "vendor_balance_adjustments_storeId_appliedPayoutId_idx" ON "vendor_balance_adjustments"("storeId", "appliedPayoutId")` | identical, same index name | **Identical.** |
| **Foreign keys** | *(no statement at all)* | *(none)* | **NO FOREIGN-KEY CHANGE.** |

**Verdict: the hand-written SQL is correct and was NOT changed.** The only
difference is cosmetic: Prisma emits the four `ALTER TABLE` operations as one
merged statement while the hand-written file writes them as four separate
statements (same effect, same order of operations). Prisma's `ADD VALUE`
without `IF NOT EXISTS` is the only other difference, and the hand-written
variant is the more defensive of the two.

**The drift that WAS found and fixed.** Running the same diff against a copy
of the schema *without* the `onDelete: Restrict` fix produces the foreign-key
statements that must not exist:

```sql
-- DropForeignKey
ALTER TABLE "vendor_balance_adjustments" DROP CONSTRAINT "vendor_balance_adjustments_appliedPayoutId_fkey";

-- AddForeignKey
ALTER TABLE "vendor_balance_adjustments" ADD CONSTRAINT "vendor_balance_adjustments_appliedPayoutId_fkey"
  FOREIGN KEY ("appliedPayoutId") REFERENCES "vendor_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

With `onDelete: Restrict` in place, that statement disappears entirely - which
is the proof that the datamodel now matches the database constraint
(`ON DELETE RESTRICT ON UPDATE CASCADE`, section 7.0).

**Other commands run** (both against a dummy `DATABASE_URL`, never a real
database):

| Command | Result |
| --- | --- |
| `npx prisma validate` | `The schema at prisma\schema.prisma is valid` |
| `npx prisma generate` | `Generated Prisma Client (v7.6.0)` |

`--from-schema` / `--to-schema` compare two schema files and never open a
connection, so no database was reachable, let alone contacted. `prisma
migrate` (any form), `prisma db push` and `prisma db seed` were **not** run
at any point in this task.

---

## 8. Test count reconciliation

### 8.1 The three numbers

| Measurement | Files | Passed | Todo | When |
| --- | --- | --- | --- | --- |
| Safety-net baseline (`docs/safety-net/BASELINE.md`) | 80 | 917 | 0 | commit `e615ffe`, suite run 2026-10-20 02:07:53 |
| Safety-net report, after the two characterization files | 82 | **978** | 5 | the safety-net task's final report |
| Corrective-ledger starting point | 84 | **992** | 5 | the tree this task started from |
| **Difference** | **2** | **14** | 0 | |

The characterization files were counted in **both** numbers - they are not the
difference. The difference is two *other* files.

### 8.2 The two files and the 14 tests, by name

| # | File | Tests | Landed in | Commit date |
| --- | --- | --- | --- | --- |
| 1 | `lib/migrations-encoding.test.ts` | **5** | `8bc10fa` - *Merge remote-tracking branch 'origin/main' into feature/seller-os-money-view* | 2026-10-20 02:46:11 |
| 2 | `scripts/assert-local-db.test.ts` | **9** | `e0c6553` - *chore(dev): add a guarded local Postgres stack for dev and integration tests* | 2026-10-20 03:28:37 |
| | **Total** | **14** | | |

The 14 tests, named:

`lib/migrations-encoding.test.ts` (5):

1. `checkMigrationEncoding > accepts a clean SQL buffer`
2. `checkMigrationEncoding > rejects a UTF-16LE buffer with a BOM`
3. `checkMigrationEncoding > rejects a buffer containing a NUL byte`
4. `checkMigrationEncoding > rejects invalid UTF-8`
5. `prisma migration files > contains no encoding problems in any migration.sql`

`scripts/assert-local-db.test.ts` (9):

6. `assertLocalDatabaseUrl > accepts the local development database`
7. `assertLocalDatabaseUrl > rejects a remote host`
8. `assertLocalDatabaseUrl > rejects a local host on the wrong port`
9. `assertLocalDatabaseUrl > rejects the wrong database name`
10. `assertLocalDatabaseUrl > rejects a host that merely looks local`
11. `assertLocalDatabaseUrl > rejects values that are not PostgreSQL URLs`
12. `assert-local-db command > exits zero for the local development database`
13. `assert-local-db command > exits non-zero for a remote database`
14. `assert-local-db command > never prints the URL it rejected`

### 8.3 Why the safety-net report did not see them

Both files arrived in commits made **after** the safety-net task measured the
suite. The commit timeline on 2026-10-20 (all times UTC):

```
01:53:08  e615ffe   chore: ignore the scratch directories ...   <- the safety-net BASELINE commit
02:07:53  (the baseline `npx vitest run` starts: 80 files / 917 passed)
02:46:11  8bc10fa   Merge origin/main -> feature/seller-os-money-view   (+ lib/migrations-encoding.test.ts, 5 tests)
03:28:37  e0c6553   chore(dev): add a guarded local Postgres stack        (+ scripts/assert-local-db.test.ts, 9 tests)
```

`docs/safety-net/BASELINE.md` records the baseline as commit `e615ffe` with a
clean tree, and `git show --stat` confirms the two later commits each add one
test file:

```
$ git show --stat --oneline 8bc10fa
 lib/check-migration-encoding.ts | 63 +++++
 lib/migrations-encoding.test.ts | 62 ++++

$ git show --stat --oneline e0c6553
 docker-compose.dev.yml          |  43 ++
 docs/local-database.md          | 106 +++
 package.json                    |   5 +
 scripts/assert-local-db.mjs     | 198 +++++
 scripts/assert-local-db.test.ts |  67 +++
```

So the arithmetic closes exactly:

```
safety-net baseline              80 files    917 passed
+ the 2 characterization files    2 files  +  61 passed   (26 + 35)
                                   ----       ----
safety-net report                82 files    978 passed
+ lib/migrations-encoding.test.ts 1 file  +   5 passed
+ scripts/assert-local-db.test.ts 1 file  +   9 passed
                                   ----       ----
corrective-ledger starting point 84 files    992 passed
```

The 61 characterization tests are `payouts.characterization.test.ts` (26) and
`[payoutId]/payout-status.characterization.test.ts` (35).

Neither of the two mystery files was created by the safety-net task or by the
corrective-ledger task; both are ordinary repository files that happened to
land between the two measurements.

### 8.4 A note on the counting convention

Two different counters are in play, and mixing them is what makes the numbers
look like they disagree:

* `npx vitest run` reports `Tests  <passed> passed | <todo> todo (<total>)`.
  The grand total **includes** the todo tests.
* `npx vitest list` **excludes** `it.todo` tests - it lists only the tests
  that actually execute.

For example, `payouts.characterization.test.ts` declares 21 plain `it(...)`
tests, one `it.each` over 5 cases and 5 `it.todo` tests. `vitest list`
reports **26** for it (21 + 5, no todo); `vitest run` reports **26 passed and
5 todo** for it. Every count in the table above is a *passed* count, so all
three measurements are directly comparable.

### 8.5 The current count

After the corrective-ledger work, `lib/ledger/` contributes 2 more files
(`clawback.test.ts` with 30 tests, `corrective-ledger.test.ts` with 23):

```
corrective-ledger starting point  84 files    992 passed | 5 todo
+ lib/ledger/clawback.test.ts      1 file  +  30 passed
+ lib/ledger/corrective-ledger.test.ts 1 file +  23 passed
                                   ----       ----
now                               86 files   1045 passed | 5 todo
```

and the suite reports:

```
 Test Files  86 passed (86)
      Tests  1045 passed | 5 todo (1050)
```

This was cross-checked with two independent `npx vitest list --json` captures,
one taken before and one after this task's test changes. The **only** files
whose count moved are the two ledger files:

| File | Before | After | Delta |
| --- | --- | --- | --- |
| `lib/ledger/clawback.test.ts` | 26 | 30 | +4 |
| `lib/ledger/corrective-ledger.test.ts` | 17 | 23 | +6 |
| every other file in the repo | 992 | 992 | 0 |

---

## 9. Scope boundary

* New code lives in `lib/ledger/` only. **No file outside `lib/ledger/` imports
  it**, and no production request path calls it. The whole module is dormant.
* `lib/ledger/` imports **out** of itself exactly once, and only in the
  direction that is safe: `lib/ledger/corrective-ledger.ts` imports
  `Caps` from `@/lib/refunds/process-refund` to obtain the item's refundable
  cap (section 4.6). Nothing in `lib/refunds` imports `lib/ledger`, so the
  dependency does not create a cycle and cannot pull the dormant ledger into
  a production path.
* `prisma/schema.prisma` is the only existing file that was modified, and only
  in the places listed in section 7.
* The new code is verified with fakes only. No test in this task opens a
  database connection, and no `prisma migrate`, `db push` or seed was run.
* Deduction from payouts, the vendor-facing balance views, the payout
  eligibility aggregate and the refund-requests queue are all **out of scope**
  and untouched.
