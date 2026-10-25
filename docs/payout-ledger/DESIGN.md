# Payout Ledger — Design

**Status:** dormant, flag-gated. `PAYOUT_LEDGER_MODE` defaults to `off`. With the flag off, production payout behaviour is byte-for-byte unchanged.

## Scope

Allowed modified files: `lib/feature-flags.ts` (flag readers), `app/api/vendor/payouts/route.ts` (mode switch inside POST only). All other code untouched. New files only under `lib/ledger/*`, `app/api/vendor/payouts/payouts.ledger.test.ts`, `scripts/payout-eligibility-compare.ts`, and `docs/payout-ledger/*`. No schema changes, no migrations.

## Findings

### Delivery timestamp

`OrderItem.deliveredAt` (schema `prisma/schema.prisma:578`) is the reliable per-item delivery timestamp. It is stamped by `stampOrderItems` (`lib/order-delivery-stamps.ts`) when an order transitions to `DELIVERED` (via status or fulfillment status). `deliveryConfirmedAt` (`lib/delivery.ts`) is the effective confirmation (auto-confirm adds `autoConfirmDeliveryDays` after `deliveredAt`), but the payout hold uses "delivered at", so `OrderItem.deliveredAt` is used. `Order.completedAt` does not exist; `COMPLETED` alone stamps nothing but is only reachable from `DELIVERED`, so `deliveredAt` is normally already set. Items with a null or future `deliveredAt` are excluded from eligibility.

### Payment status values

`OrderStatus`: PENDING, PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED. `PaymentStatus`: PENDING, PAID, FAILED, CANCELLED, REFUNDED. A partially refunded order keeps `paymentStatus = PAID`; only a full refund flips it to `REFUNDED`. This means a partially-refunded item stays in S and its clawback debit reduces available; a fully-refunded item drops out of S entirely (no double-count).

### ReturnRequest hold decision

`ReturnStatus`: PENDING, ITEM_IN_TRANSIT, ITEM_RECEIVED, AWAITING_REFUND, ESCALATED, REJECTED, CLOSED. Production code never creates `ReturnRequest` rows (`Refund.returnRequestId` is never populated; see `docs/safety-net/REFUND_COVERAGE.md`). The open-versus-resolved distinction exists semantically (PENDING/ITEM_IN_TRANSIT/ITEM_RECEIVED/AWAITING_REFUND/ESCALATED open; REJECTED/CLOSED resolved), but since no rows exist in production the exclusion has no effect and no production caller populates it. Per the design ("only if semantics are clear; otherwise report and skip"), the hold **does not** exclude items by open ReturnRequest, and this is documented here. If ReturnRequest usage is turned on later, the exclusion can be added to `computeStoreBalance`.

### VendorPayoutItem conclusion

Confirmed: `VendorPayoutItem.orderItemId` is `@unique` (`schema:2648`), so writing it forces whole-item payouts, incompatible with arbitrary-amount payouts. This task does **not** write `VendorPayoutItem` rows.

### Existing flags

`lib/feature-flags.ts` previously only had `isEmailServiceEnabled` and `isLedgerShadowWriteEnabled`. No payout mode flag existed. `PAYOUT_LEDGER_MODE` (`off|compare|enforce`) is registered there following the existing env-reader pattern (default `off`). `PAYOUT_HOLD_DAYS` (0-90, default 7) is also registered there. `PlatformPolicy.payoutMode` (`REPORT_ONLY|AUTOMATIC|MANUAL`) is a different, unrelated concept and is not read by this feature.

### Lock pattern

The codebase row-locks via `tx.$queryRaw\`SELECT id FROM "<table>" WHERE id = ${id} FOR UPDATE\`` (e.g. `lib/refunds/refund-service.ts:406`, `lib/stock-reservation.ts`). `createPayoutWithinLedger` reuses the same row-lock style on the `stores` table keyed by store id inside the transaction.

### Other consumers of the old calculation

`getVendorUnpaidEligibleEarnings` is private to `app/api/vendor/payouts/route.ts` only. No dashboard, cron, webhook, checkout, or refund route computes available/eligible earnings. `GET /api/vendor/payouts` only lists payouts; it does not compute eligibility, so no GET switch is needed.

## Final formula

Per store, with `now` and `holdDays` (default `PAYOUT_HOLD_DAYS`):

- S = { order items : product.storeId = storeId, order.paymentStatus = PAID, order.status in {DELIVERED, COMPLETED}, order.source = ONLINE, item.deliveredAt not null, item.deliveredAt + holdDays days <= now }
- credits = Σ over S of round2(item.vendorEarnings) (null → 0), each item rounded to 2 dp before summing
- debits = -(Σ of all `VendorBalanceAdjustment.amount` (any adjustmentType) whose orderItemId ∈ S); a negative amount is a debit (increases debits), a positive amount is a credit (reduces debits)
- paid = Σ `VendorPayout.amount` where (storeId = storeId OR vendorId = store's vendor) and status in {PENDING, PROCESSING, PAID}. Legacy payouts with a null storeId and payouts recorded against another store of the same vendor are included; this is the conservative choice so paid_new >= paid_old (legacy scoping is by vendorId). See "Paid scoping" below.
- net = credits − debits − paid (unclamped, reported for carry-forward visibility)
- available = max(0, net)

Money maths: all Float inputs via `new Prisma.Decimal(String(value))`; rounding via `toDecimalPlaces(2, ROUND_HALF_UP)`; never add floats.

A debit on an item inside the hold window is ignored until the item enters S (because debits are scoped to orderItemId ∈ S). A fully-refunded order leaves S, taking its debits with it — no double deduction. Negative net carries forward automatically (no stored state); next period's earnings reduce the debt.

Deviation from design: ReturnRequest open-exclusion is omitted (documented above; production never creates rows). `paid` is scoped conservatively by vendor (see "Paid scoping" below) rather than by store alone, so paid_new is never smaller than the legacy (vendor-scoped) paid.

## Paid scoping

The legacy calculation (`getVendorUnpaidEligibleEarnings` in `app/api/vendor/payouts/route.ts`) subtracts payouts scoped by `vendorId` (status in {PENDING, PROCESSING, PAID}). The new calculation is per-store. To guarantee `paid_new >= paid_old` for the payout-status component:

- `computeStoreBalance` resolves the store's owning vendor (`store.userId`) and includes a payout if `storeId = this store` OR `vendorId = this vendor`. This is the union of store-scoped and vendor-scoped payouts.
- Consequences:
  - A legacy payout whose `storeId` is null is still subtracted (matched by `vendorId`).
  - A payout recorded against another store of the same vendor is subtracted from this store's available too. This over-subtracts for a vendor that owns several stores, but a vendor owns a single store in the current data model (`store.findUnique({ where: { userId } })`), so in practice there is no over-subtraction. The choice is documented as the conservative option: never subtract less than the legacy calculation.
  - `VendorPayout.storeId` is NOT nullable in `prisma/schema.prisma` (required `String`); POST always sets `storeId = store.id`. The null-storeId case is therefore only reachable for legacy rows and is handled defensively.

## Signed debits convention

`VendorBalanceAdjustment.amount` is signed: a negative amount is a debit (money withheld from the vendor, e.g. a REFUND_CLAWBACK), a positive amount is a credit. `debits = -(sum of amount)` over adjustments whose `orderItemId` is in S, so a negative amount increases debits and a positive amount reduces them. `net = credits - debits - paid` is unchanged. Other readers of adjustments (corrective-ledger alreadyClawedBack, reconcile) use the same convention (negated sum rather than magnitude sum). REFUND_CLAWBACK entries are stored as negative amounts.

## Edge cases

- null vendorEarnings → treated as 0 for credits.
- Negative balance carry-forward: net reported negative; available clamped at 0.
- Debit on an item outside S: not subtracted (scoped to S).
- Payout FAILED/CANCELLED: not subtracted from paid.
- Hold boundary: item delivered exactly holdDays ago is eligible; one second less (more recent) is not.
- Future-dated or null delivery timestamp: excluded.
- Rounding: each item's vendorEarnings rounded to 2 dp before SUM; thirds/awkward floats exact via Decimal.

## Rollout plan

1. Deploy with `PAYOUT_LEDGER_MODE=off` (default): no behaviour change, no new queries, no `$transaction`.
2. Shadow with `PAYOUT_LEDGER_MODE=compare`: old logic decides; new balance computed alongside; difference logged (storeId, oldAvailable, newAvailable, delta; nothing else). Verify zero/acceptable deltas in staging.
3. Enforce with `PAYOUT_LEDGER_MODE=enforce`: new balance decides; rejects above available with 400 + `availableEarnings`.
4. `PAYOUT_HOLD_DAYS` defaults to 7; invalid values fall back to 7 with a one-time warning.

True concurrency safety (enforce mode under real Postgres) cannot be proven with fakes; it needs a staging run with concurrent requests.

## Coverage of characterization `it.todo` items

The five `it.todo` items in `app/api/vendor/payouts/payouts.characterization.test.ts` ("desired behaviour (not implemented yet)") are mapped to new tests as follows:

| it.todo | Covered by |
|---|---|
| excludes refunded order items from eligible earnings | `lib/ledger/payout-eligibility.test.ts` "full refund: order REFUNDED drops out of S..." |
| creates VendorPayoutItem rows in the same transaction as the payout | Not implemented — `VendorPayoutItem.orderItemId` is unique, incompatible with arbitrary-amount payouts (see DESIGN conclusion). |
| rejects concurrent payout requests that together exceed eligible earnings | `lib/ledger/payout-create.test.ts` "two sequential calls exceeding available: second rejected" (row lock); true concurrency needs Postgres staging. |
| subtracts VendorBalanceAdjustment amounts | `lib/ledger/payout-eligibility.test.ts` "partial refund debit reduces available" and "debit on an item inside the hold window ignored..." |
| respects a dispute hold window | `lib/ledger/payout-eligibility.test.ts` "hold window: exactly holdDays ago eligible..." |

Notes: ReturnRequest hold excluded per findings above; VendorPayoutItem intentionally not written.
