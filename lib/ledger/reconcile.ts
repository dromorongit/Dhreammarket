// Reconciliation for the Corrective Ledger's REFUND_CLAWBACK entries.
//
// Compares every PROCESSED refund against its ledger entry
// (`refund-clawback:` + refund id) and reports what is missing or mismatched.
// With `apply: true` it backfills ONLY the missing entries - never updating or
// deleting existing ones - so it is safe to re-run.
//
// Money maths uses Prisma.Decimal only. Reports carry ids, counts and amounts
// only - never customer data.
import { Prisma } from '@prisma/client'
import { Caps } from '@/lib/refunds/process-refund'
import { computeVendorClawback } from './clawback'
import {
  recordRefundClawback,
  refundClawbackIdempotencyKey,
  type LedgerClient,
} from './corrective-ledger'

const DEFAULT_LIMIT = 50

export type ClawbackReconcileOptions = {
  /** Write missing entries back to the ledger. Defaults to false (dry run). */
  apply?: boolean
  /** Page size for the PROCESSED refund scan. Defaults to 50. */
  limit?: number
  /** Only consider refunds created at or after this date. */
  sinceDate?: Date
}

export type ClawbackReconcileReport = {
  refundsChecked: number
  alreadyRecorded: number
  missing: number
  mismatches: number
  skipped: number
  /** Reason -> count, for refunds that cannot produce a determinable debit. */
  skippedReasons: Record<string, number>
  missingRefundIds: string[]
  mismatchedRefundIds: string[]
  /** How many missing entries were backfilled (apply mode only). */
  backfilled: number
  /** The refund id where apply stopped on an unexpected error, null otherwise. */
  stoppedAfterRefundId: string | null
  /** Expected debit per store (Decimal strings), for missing and mismatched refunds. */
  expectedDebitByStore: Record<string, string>
  /** Recorded debit per store (Decimal strings), for existing entries. */
  recordedDebitByStore: Record<string, string>
}

function zero(): Prisma.Decimal {
  return new Prisma.Decimal(0)
}

function toDecimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) return zero()
  if (value instanceof Prisma.Decimal) return value
  return new Prisma.Decimal(String(value))
}

function addDecimal(current: string | undefined, value: Prisma.Decimal): string {
  const total = (current ? new Prisma.Decimal(current) : zero()).plus(value)
  return total.toFixed(2)
}

type RefundAssessment = {
  /** Non-null when this refund cannot produce a determinable debit. */
  reason: string | null
  /** The store the debit belongs to (null when skipped). */
  storeId: string | null
  /** The debit this refund should produce: zero or negative (null when skipped). */
  expected: Prisma.Decimal | null
}

/**
 * Assess one PROCESSED refund against what its ledger entry should be, using
 * the same inputs `recordRefundClawback` would use, without writing anything.
 */
async function assessRefund(client: LedgerClient, refund: any): Promise<RefundAssessment> {
  const orderItem = refund.orderItem
  if (!orderItem) return { reason: 'ORDER_ITEM_NOT_FOUND', storeId: null, expected: null }

  const store = orderItem.product?.store
  if (!store || !store.id) return { reason: 'STORE_NOT_FOUND', storeId: null, expected: null }

  const storeId = store.id
  if (!store.userId) return { reason: 'VENDOR_NOT_FOUND', storeId: null, expected: null }
  if (orderItem.vendorEarnings === null || orderItem.vendorEarnings === undefined) {
    return { reason: 'VENDOR_EARNINGS_UNKNOWN', storeId, expected: null }
  }

  const order = orderItem.order
  if (!order || !order.payment) return { reason: 'REFUNDABLE_CAP_UNKNOWN', storeId, expected: null }

  const itemCap = Caps.forOrder({
    id: order.id,
    total: order.total,
    items: order.items,
    payment: order.payment,
  }).itemCap(orderItem.id)
  if (!itemCap || itemCap <= 0) return { reason: 'REFUNDABLE_CAP_UNKNOWN', storeId, expected: null }

  const [itemRefunds, itemAdjustments] = await Promise.all([
    client.refund.findMany({
      where: { orderItemId: orderItem.id, status: 'PROCESSED' },
      select: { id: true, amount: true },
    }),
    client.vendorBalanceAdjustment.findMany({
      where: { orderItemId: orderItem.id, adjustmentType: 'REFUND_CLAWBACK' },
      select: { id: true, amount: true, refundId: true },
    }),
  ])

  const alreadyRefundedValueBefore = itemRefunds
    .filter((row) => row.id !== refund.id)
    .reduce((sum, row) => sum.plus(toDecimal(row.amount)), zero())

  const alreadyClawedBack = itemAdjustments
    .filter((row) => row.refundId !== refund.id)
    .reduce((sum, row) => sum.plus(toDecimal(row.amount).abs()), zero())

  const expected = computeVendorClawback({
    itemRefundableCap: new Prisma.Decimal(String(itemCap)),
    itemVendorEarnings: new Prisma.Decimal(String(orderItem.vendorEarnings)),
    refundedValueThisRefund: toDecimal(refund.amount),
    alreadyRefundedValueBefore,
    alreadyClawedBack,
  })

  if (expected.isZero()) return { reason: 'NOTHING_TO_CLAW_BACK', storeId, expected: null }
  return { reason: null, storeId, expected }
}

export async function reconcileClawbacks(
  client: LedgerClient,
  options: ClawbackReconcileOptions = {}
): Promise<ClawbackReconcileReport> {
  const { apply = false, limit = DEFAULT_LIMIT, sinceDate } = options

  const report: ClawbackReconcileReport = {
    refundsChecked: 0,
    alreadyRecorded: 0,
    missing: 0,
    mismatches: 0,
    skipped: 0,
    skippedReasons: {},
    missingRefundIds: [],
    mismatchedRefundIds: [],
    backfilled: 0,
    stoppedAfterRefundId: null,
    expectedDebitByStore: {},
    recordedDebitByStore: {},
  }

  let after: string | undefined
  let stopped = false

  while (!stopped) {
    const page = await client.refund.findMany({
      where: {
        status: 'PROCESSED',
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        orderItem: {
          select: {
            id: true,
            vendorEarnings: true,
            order: {
              select: {
                id: true,
                total: true,
                items: { select: { id: true, price: true, quantity: true } },
                payment: { select: { id: true, amount: true } },
              },
            },
            product: { select: { store: { select: { id: true, userId: true } } } },
          },
        },
      },
    })

    if (page.length === 0) break

    for (const refund of page) {
      if (stopped) break

      report.refundsChecked += 1

      const existing = await client.vendorBalanceAdjustment.findFirst({
        where: { idempotencyKey: refundClawbackIdempotencyKey(refund.id) },
      })

      const assessment = await assessRefund(client, refund)
      if (assessment.reason) {
        // A skipped refund can still have a stale ledger entry: record it so
        // the per-store recorded total reflects what is actually written.
        if (existing && assessment.storeId) {
          report.recordedDebitByStore[assessment.storeId] = addDecimal(
            report.recordedDebitByStore[assessment.storeId],
            existing.amount
          )
        }
        report.skipped += 1
        report.skippedReasons[assessment.reason] = (report.skippedReasons[assessment.reason] ?? 0) + 1
        continue
      }

      if (existing) {
        if (assessment.storeId) {
          report.recordedDebitByStore[assessment.storeId] = addDecimal(
            report.recordedDebitByStore[assessment.storeId],
            existing.amount
          )
        }
        if (existing.amount.equals(assessment.expected!)) {
          report.alreadyRecorded += 1
        } else {
          report.mismatches += 1
          report.mismatchedRefundIds.push(refund.id)
          if (assessment.storeId && assessment.expected) {
            report.expectedDebitByStore[assessment.storeId] = addDecimal(
              report.expectedDebitByStore[assessment.storeId],
              assessment.expected
            )
          }
        }
        continue
      }

      // Missing entry: this is what apply mode backfills.
      report.missing += 1
      report.missingRefundIds.push(refund.id)
      if (assessment.storeId && assessment.expected) {
        report.expectedDebitByStore[assessment.storeId] = addDecimal(
          report.expectedDebitByStore[assessment.storeId],
          assessment.expected
        )
      }

      if (apply && !stopped) {
        try {
          const result = await recordRefundClawback(client, refund.id)
          if (result.status === 'created') {
            report.backfilled += 1
          }
        } catch (error) {
          stopped = true
          report.stoppedAfterRefundId = refund.id
        }
      }
    }

    if (page.length < limit) break
    after = page[page.length - 1].id
  }

  return report
}
