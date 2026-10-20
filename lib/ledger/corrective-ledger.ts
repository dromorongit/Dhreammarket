// The Corrective Ledger: an idempotent, append-only record of a vendor's
// refund clawback.
//
// Business rule: when a customer is refunded, the VENDOR bears the cost. The
// cost is recorded as an OPEN (unapplied) ledger entry against the vendor and
// carries forward to be deducted from the vendor's NEXT payout.
//
// DORMANT. Nothing outside this directory calls this module, and nothing in
// this module is wired to a production request path. Deduction from payouts
// is NOT implemented here: the ledger is append-only in this task, and no
// exported function updates or deletes an entry.
//
// The caller passes the Prisma client (or a transaction client) in. This
// module never opens a connection of its own and never imports getPrisma().
//
// MONEY
// -----
// Every amount is a Prisma.Decimal. Float inputs (the OrderItem money
// columns are Float) are converted through `new Prisma.Decimal(String(value))`
// so the binary float noise never reaches the arithmetic.
//
// THE REFUNDABLE CAP
// ------------------
// The clawback ratio is applied to the item's REFUNDABLE CAP, not to the item
// gross. The cap is the item's pro-rata share of the charged payment, and it
// is what the refund service itself enforces
// (`Caps.validate`, lib/refunds/process-refund.ts). The cap is obtained by
// REUSING `Caps.forOrder` - the very same pure function the refund service
// calls - so the ledger's denominator and the refund service's limit can
// never drift apart. `Caps.forOrder` is a pure function of the order shape it
// is given; it opens no connection and reads nothing by itself.
//
// PERSONAL DATA
// -------------
// The note written on an entry carries ids only. `Refund.reason` is free text
// typed by an administrator and may contain customer data, so it is never
// copied into the ledger.
import { Prisma, type PrismaClient } from '@prisma/client'
import { Caps } from '@/lib/refunds/process-refund'
import { computeVendorClawback } from './clawback'

/**
 * A Prisma client or a transaction client.
 *
 * This is the same shape the rest of the codebase uses to accept an injected
 * client (see `lib/stock-reservation.ts`).
 */
export type LedgerClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
>

export const REFUND_CLAWBACK_ADJUSTMENT_TYPE = 'REFUND_CLAWBACK' as const

export type RecordRefundClawbackResult = {
  /** `created` - a new open debit was written. */
  status: 'created' | 'already_recorded' | 'skipped'
  /** The idempotency key that was used. */
  idempotencyKey: string
  /** The ledger entry, when one exists. */
  entryId?: string
  /** The debit that was recorded (a negative amount). */
  amount?: Prisma.Decimal
  /** Why nothing was done. Only set when the status is `skipped`. */
  reason?: string
}

export type OpenDebitEntry = {
  id: string
  vendorId: string
  storeId: string
  orderItemId: string
  refundId: string
  amount: Prisma.Decimal
  currency: string
  createdAt: Date
}

/**
 * The idempotency key for a refund's clawback.
 *
 * Derived from the refund id, which identifies exactly one refund and never
 * changes. It is never derived from a count of existing rows.
 */
export function refundClawbackIdempotencyKey(refundId: string): string {
  return `refund-clawback:${refundId}`
}

/** Convert anything money-shaped into a Prisma.Decimal. */
function toDecimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0)
  if (value instanceof Prisma.Decimal) return value
  if (typeof value === 'number') return new Prisma.Decimal(String(value))
  return new Prisma.Decimal(String(value))
}

/**
 * True when the error is Prisma's P2002 (unique constraint violation).
 *
 * The constraint that can fire here is the unique index on
 * `idempotencyKey`. When the error carries a target, the target must be that
 * index; a P2002 on anything else is a real error and is re-thrown.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; meta?: { target?: unknown } }
  if (candidate.code !== 'P2002') return false
  const target = candidate.meta?.target
  if (target === undefined || target === null) return true
  return String(target).includes('idempotencyKey')
}

/**
 * Record the vendor clawback for one refund.
 *
 * The function never throws for "there is nothing to do": a refund that is
 * not PROCESSED, an item with no vendor earnings, an unresolvable store - all
 * of those come back as `skipped` with a reason.
 *
 * It IS safe to call twice, and safe to call concurrently: the unique index
 * on `idempotencyKey` is the real guard, and a lost race (P2002) is reported
 * as `already_recorded`.
 */
export async function recordRefundClawback(
  tx: LedgerClient,
  refundId: string
): Promise<RecordRefundClawbackResult> {
  const idempotencyKey = refundClawbackIdempotencyKey(refundId)

  // Fast path: the entry for this refund already exists.
  const existing = await tx.vendorBalanceAdjustment.findFirst({ where: { idempotencyKey } })
  if (existing) {
    return {
      status: 'already_recorded',
      idempotencyKey,
      entryId: existing.id,
      amount: toDecimal(existing.amount),
    }
  }

  const refund = await tx.refund.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      orderItem: {
        select: {
          id: true,
          vendorEarnings: true,
          // The refundable cap is the item's pro-rata share of the CHARGED
          // payment, so the whole order and its payment are needed.
          order: {
            select: {
              id: true,
              total: true,
              items: { select: { id: true, price: true, quantity: true } },
              payment: { select: { id: true, amount: true } },
            },
          },
          product: {
            select: {
              store: { select: { id: true, userId: true } },
            },
          },
        },
      },
    },
  })

  if (!refund) {
    return { status: 'skipped', idempotencyKey, reason: 'REFUND_NOT_FOUND' }
  }

  // Only a refund that actually returned money costs the vendor something.
  if (refund.status !== 'PROCESSED') {
    return { status: 'skipped', idempotencyKey, reason: 'REFUND_NOT_PROCESSED' }
  }

  const orderItem = refund.orderItem
  if (!orderItem) {
    return { status: 'skipped', idempotencyKey, reason: 'ORDER_ITEM_NOT_FOUND' }
  }

  const store = orderItem.product?.store
  if (!store || !store.id) {
    return { status: 'skipped', idempotencyKey, reason: 'STORE_NOT_FOUND' }
  }

  // The vendor is the user who owns the store.
  const vendorId = store.userId
  if (!vendorId) {
    return { status: 'skipped', idempotencyKey, reason: 'VENDOR_NOT_FOUND' }
  }

  if (orderItem.vendorEarnings === null || orderItem.vendorEarnings === undefined) {
    return { status: 'skipped', idempotencyKey, reason: 'VENDOR_EARNINGS_UNKNOWN' }
  }

  // The item's refundable cap: its pro-rata share of the charged payment.
  //
  // `Caps.forOrder` is the same pure function the refund service uses to
  // build the cap it enforces, so the ledger's denominator is exactly the
  // limit the refund was allowed to reach. It allocates the payment across
  // the order's items with the rounding remainder on the last item, which is
  // why the WHOLE item list is read here rather than just this one item.
  const order = orderItem.order
  if (!order || !order.payment) {
    return { status: 'skipped', idempotencyKey, reason: 'REFUNDABLE_CAP_UNKNOWN' }
  }

  const itemRefundableCap = Caps.forOrder({
    id: order.id,
    total: order.total,
    items: order.items,
    payment: order.payment,
  }).itemCap(orderItem.id)

  if (!itemRefundableCap || itemRefundableCap <= 0) {
    return { status: 'skipped', idempotencyKey, reason: 'REFUNDABLE_CAP_UNKNOWN' }
  }

  // The value refunded on this item so far, and the magnitude already clawed
  // back for it. Only PROCESSED refunds count: money that has not gone back
  // to the customer has not cost the vendor anything yet.
  const [itemRefunds, itemAdjustments] = await Promise.all([
    tx.refund.findMany({
      where: { orderItemId: orderItem.id, status: 'PROCESSED' },
      select: { id: true, amount: true },
    }),
    tx.vendorBalanceAdjustment.findMany({
      where: { orderItemId: orderItem.id, adjustmentType: REFUND_CLAWBACK_ADJUSTMENT_TYPE },
      select: { id: true, amount: true },
    }),
  ])

  const alreadyRefundedValueBefore = itemRefunds
    .filter((row) => row.id !== refund.id)
    .reduce((sum, row) => sum.plus(toDecimal(row.amount)), new Prisma.Decimal(0))

  const alreadyClawedBack = itemAdjustments.reduce(
    (sum, row) => sum.plus(toDecimal(row.amount).abs()),
    new Prisma.Decimal(0)
  )

  const debit = computeVendorClawback({
    itemRefundableCap,
    itemVendorEarnings: orderItem.vendorEarnings,
    refundedValueThisRefund: refund.amount,
    alreadyRefundedValueBefore,
    alreadyClawedBack,
  })

  if (debit.isZero()) {
    return { status: 'skipped', idempotencyKey, reason: 'NOTHING_TO_CLAW_BACK' }
  }

  try {
    const entry = await tx.vendorBalanceAdjustment.create({
      data: {
        vendorId,
        storeId: store.id,
        // OPEN: the debit carries forward and is deducted from the vendor's
        // NEXT payout. That deduction is not implemented yet.
        appliedPayoutId: null,
        appliedAt: null,
        orderItemId: orderItem.id,
        refundId: refund.id,
        adjustmentType: REFUND_CLAWBACK_ADJUSTMENT_TYPE,
        amount: debit,
        idempotencyKey,
        currency: refund.currency || 'GHS',
        // Ids only: Refund.reason is free text and may hold customer data.
        note: `Vendor refund clawback for refund ${refund.id} (order item ${orderItem.id}).`,
      },
    })

    return {
      status: 'created',
      idempotencyKey,
      entryId: entry.id,
      amount: toDecimal(entry.amount),
    }
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      // A concurrent call won the race. The row exists; nothing else to do.
      const raced = await tx.vendorBalanceAdjustment.findFirst({ where: { idempotencyKey } })
      return {
        status: 'already_recorded',
        idempotencyKey,
        entryId: raced?.id,
        amount: raced ? toDecimal(raced.amount) : undefined,
      }
    }
    throw error
  }
}

/**
 * Every open (unapplied) ledger entry for a store.
 *
 * An entry is open when it has not been deducted from a payout yet, which is
 * exactly `appliedPayoutId IS NULL`.
 */
export async function getOpenDebitEntries(
  client: LedgerClient,
  storeId: string
): Promise<OpenDebitEntry[]> {
  const rows = await client.vendorBalanceAdjustment.findMany({
    where: { storeId, appliedPayoutId: null },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((row) => ({
    id: row.id,
    vendorId: row.vendorId,
    storeId: row.storeId,
    orderItemId: row.orderItemId,
    refundId: row.refundId,
    amount: toDecimal(row.amount),
    currency: row.currency,
    createdAt: row.createdAt,
  }))
}

/**
 * The total of a store's open debits, as a POSITIVE magnitude.
 *
 * Entries that have already been applied to a payout are excluded. A debit is
 * a negative amount, so the sum of the open debits is negative and comes back
 * here as the positive number that will be deducted from the next payout.
 */
export async function getOpenDebitsForStore(
  client: LedgerClient,
  storeId: string
): Promise<Prisma.Decimal> {
  const entries = await getOpenDebitEntries(client, storeId)

  const total = entries.reduce((sum, entry) => {
    const amount = entry.amount
    // Only debits count towards the amount that will be withheld.
    if (!amount.isNegative()) return sum
    return sum.plus(amount)
  }, new Prisma.Decimal(0))

  return total.abs()
}
