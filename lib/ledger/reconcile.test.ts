import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { type LedgerClient } from './corrective-ledger'
import { reconcileClawbacks, type ClawbackReconcileReport } from './reconcile'

const origFlag = process.env.LEDGER_SHADOW_WRITE

beforeEach(() => {
  delete process.env.LEDGER_SHADOW_WRITE
  vi.resetAllMocks()
})

afterEach(() => {
  process.env.LEDGER_SHADOW_WRITE = origFlag
})

type FakeAdjustment = {
  id: string
  vendorId: string
  storeId: string
  appliedPayoutId: string | null
  orderItemId: string
  refundId: string
  adjustmentType: string
  amount: Prisma.Decimal
  appliedAt: Date | null
  idempotencyKey: string | null
  currency: string
  note: string | null
  createdAt: Date
}

type FakeOrderItem = {
  id: string
  vendorEarnings: number | null
  order: {
    id: string
    total: number
    items: { id: string; price: number; quantity: number }[]
    payment: { id: string; amount: number } | null
  }
  product: { store: { id: string; userId: string } | null } | null
}

type FakeRefund = {
  id: string
  amount: Prisma.Decimal
  currency: string
  status: string
  orderItemId: string
  paymentId: string
  orderItem: FakeOrderItem | null
  createdAt: Date
  idempotencyKey?: string
}

const ORDER = {
  id: 'order_1',
  total: 60,
  items: [
    { id: 'item_a', price: 10, quantity: 1 },
    { id: 'item_b', price: 20, quantity: 1 },
    { id: 'item_c', price: 30, quantity: 1 },
  ],
  payment: { id: 'pay_1', amount: 100 },
}

const ITEM_A: FakeOrderItem = {
  id: 'item_a',
  vendorEarnings: 9,
  order: ORDER,
  product: { store: { id: 'store_1', userId: 'vendor_1' } },
}

const ITEM_B: FakeOrderItem = {
  id: 'item_b',
  vendorEarnings: 18,
  order: ORDER,
  product: { store: { id: 'store_1', userId: 'vendor_1' } },
}

const ITEM_C: FakeOrderItem = {
  id: 'item_c',
  vendorEarnings: null,
  order: ORDER,
  product: { store: { id: 'store_2', userId: 'vendor_2' } },
}

// Charged payment 100.00 across gross 10 / 20 / 30: caps 16.66, 33.33, 50.01
// (the 1 pesewa remainder lands on the last item).
function makeRefund(overrides: Partial<FakeRefund> & { orderItem?: FakeOrderItem } = {}): FakeRefund {
  return {
    id: 'refund_1',
    amount: new Prisma.Decimal(10),
    currency: 'GHS',
    status: 'PROCESSED',
    orderItemId: 'item_a',
    paymentId: 'pay_1',
    orderItem: ITEM_A,
    createdAt: new Date('2026-10-20T10:00:00.000Z'),
    idempotencyKey: 'idem_1',
    ...overrides,
  }
}

function makeAdjustment(overrides: Partial<FakeAdjustment> = {}): FakeAdjustment {
  return {
    id: 'adj_1',
    vendorId: 'vendor_1',
    storeId: 'store_1',
    appliedPayoutId: null,
    orderItemId: 'item_a',
    refundId: 'refund_1',
    adjustmentType: 'REFUND_CLAWBACK',
    amount: new Prisma.Decimal(-5.4),
    appliedAt: null,
    idempotencyKey: 'refund-clawback:refund_1',
    currency: 'GHS',
    note: null,
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    ...overrides,
  }
}

function buildFake(options: {
  refunds?: FakeRefund[]
  adjustments?: FakeAdjustment[]
  throwOnRefundId?: string
} = {}) {
  const state = {
    refunds: options.refunds ?? [],
    adjustments: options.adjustments ?? [],
    nextId: 0,
    throwOnRefundId: options.throwOnRefundId,
  }

  const buildRow = (data: Record<string, any>): FakeAdjustment => {
    state.nextId += 1
    return {
      id: `adj_${state.nextId}`,
      appliedPayoutId: null,
      appliedAt: null,
      idempotencyKey: null,
      currency: 'GHS',
      note: null,
      createdAt: new Date('2026-10-20T00:00:00.000Z'),
      ...data,
    } as FakeAdjustment
  }

  const matchesWhere = (row: FakeAdjustment, where: any = {}): boolean => {
    if (where.idempotencyKey !== undefined && row.idempotencyKey !== where.idempotencyKey) return false
    if (where.orderItemId !== undefined && row.orderItemId !== where.orderItemId) return false
    if (where.adjustmentType !== undefined && row.adjustmentType !== where.adjustmentType) return false
    return true
  }

  const statusesOf = (raw: any): string[] =>
    Array.isArray(raw) ? raw : raw?.in ?? [raw]

  const paginate = (rows: any[], arg: any = {}) => {
    const { take, cursor, skip, orderBy } = arg
    let result = [...rows]
    if (orderBy?.id === 'asc') result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    if (cursor) {
      // Prisma semantics: the cursor row is inclusive, then skip rows.
      const i = result.findIndex((row) => row.id === cursor.id)
      result = i >= 0 ? result.slice(i) : []
    }
    if (skip) result = result.slice(skip)
    if (take !== undefined) result = result.slice(0, take)
    return result
  }

  const client = {
    refund: {
      findUnique: vi.fn(async ({ where }: any = {}) =>
        state.refunds.find((row) => row.id === where?.id) ?? null
      ),
      findMany: vi.fn(async (arg: any = {}) => {
        const where = arg?.where ?? {}
        let result = state.refunds.filter((row) => {
          if (where.orderItemId !== undefined && row.orderItemId !== where.orderItemId) return false
          if (where.status !== undefined) {
            const statuses = statusesOf(where.status)
            if (!statuses.includes(row.status)) return false
          }
          if (where.createdAt?.gte && new Date(row.createdAt) < new Date(where.createdAt.gte)) {
            return false
          }
          return true
        })
        return paginate(result, arg)
      }),
    },
    vendorBalanceAdjustment: {
      findFirst: vi.fn(async ({ where }: any = {}) =>
        state.adjustments.find((row) => matchesWhere(row, where)) ?? null
      ),
      findMany: vi.fn(async ({ where }: any = {}) =>
        state.adjustments.filter((row) => matchesWhere(row, where))
      ),
      create: vi.fn(async ({ data }: any) => {
        if (data.refundId === state.throwOnRefundId) {
          throw new Error('ledger write failed')
        }
        const row = buildRow(data)
        state.adjustments.push(row)
        return row
      }),
      // The ledger is append-only: these must never be called by reconciliation.
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  }

  return { client, state }
}

function asLedger(client: unknown): LedgerClient {
  return client as LedgerClient
}

const REPORT_KEYS = [
  'refundsChecked',
  'alreadyRecorded',
  'missing',
  'mismatches',
  'skipped',
  'skippedReasons',
  'missingRefundIds',
  'mismatchedRefundIds',
  'backfilled',
  'stoppedAfterRefundId',
  'expectedDebitByStore',
  'recordedDebitByStore',
]

describe('reconcileClawbacks', () => {
  it('dry run finds missing and mismatched entries and writes nothing', async () => {
    // Semantics: alreadyRefundedValueBefore = every OTHER processed refund on
    // the item; alreadyClawedBack = every OTHER entry on the item.
    // refund_a: cumulative reaches the cap via refund_b -> target 9.00, minus
    // refund_b's entry 9.99 -> nothing to claw back (skipped).
    // refund_b: refund_a's 10.00 reaches the cap -> target 9.00, minus
    // refund_a's entry 5.40 -> expected -3.60 vs recorded -9.99 (mismatch).
    // refund_c: item_b, earnings 18, cap 33.33, refund 20 -> expected -10.80 (missing).
    // refund_d: item_c has no vendor earnings -> skipped.
    const refundA = makeRefund({ id: 'refund_a', orderItem: ITEM_A })
    const refundB = makeRefund({
      id: 'refund_b',
      orderItem: ITEM_A,
      amount: new Prisma.Decimal(6.66),
    })
    const refundC = makeRefund({ id: 'refund_c', orderItem: ITEM_B, amount: new Prisma.Decimal(20) })
    const refundD = makeRefund({ id: 'refund_d', orderItem: ITEM_C, amount: new Prisma.Decimal(30) })

    const { client, state } = buildFake({
      refunds: [refundA, refundB, refundC, refundD],
      adjustments: [
        makeAdjustment({ refundId: 'refund_a', idempotencyKey: 'refund-clawback:refund_a', amount: new Prisma.Decimal(-5.4) }),
        makeAdjustment({ id: 'adj_2', refundId: 'refund_b', idempotencyKey: 'refund-clawback:refund_b', amount: new Prisma.Decimal(-9.99) }),
      ],
    })

    const report = await reconcileClawbacks(asLedger(client))

    expect(report.refundsChecked).toBe(4)
    expect(report.alreadyRecorded).toBe(0)
    expect(report.missing).toBe(1)
    expect(report.mismatches).toBe(1)
    expect(report.skipped).toBe(2)
    expect(report.skippedReasons).toEqual({
      NOTHING_TO_CLAW_BACK: 1,
      VENDOR_EARNINGS_UNKNOWN: 1,
    })
    expect(report.missingRefundIds).toEqual(['refund_c'])
    expect(report.mismatchedRefundIds).toEqual(['refund_b'])
    // -3.60 (refund_b) and -10.80 (refund_c) on store_1.
    expect(report.expectedDebitByStore).toEqual({ store_1: '-14.40' })
    // -5.40 (refund_a) and -9.99 (refund_b) on store_1.
    expect(report.recordedDebitByStore).toEqual({ store_1: '-15.39' })

    // Dry run writes nothing.
    expect(state.adjustments).toHaveLength(2)
    expect(client.vendorBalanceAdjustment.create).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.update).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.updateMany).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.delete).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.deleteMany).not.toHaveBeenCalled()
  })

  it('apply backfills only the missing entries; a second apply is a no-op', async () => {
    // refunds on different items so their histories do not entangle.
    const refundA = makeRefund({ id: 'refund_a', orderItem: ITEM_A })
    const refundB = makeRefund({ id: 'refund_b', orderItem: ITEM_B, orderItemId: 'item_b', amount: new Prisma.Decimal(20) })
    const refundC = makeRefund({ id: 'refund_c', orderItem: ITEM_C, orderItemId: 'item_c', amount: new Prisma.Decimal(30) })

    const { client, state } = buildFake({ refunds: [refundA, refundB, refundC] })

    const first = await reconcileClawbacks(asLedger(client), { apply: true })
    expect(first.missing).toBe(2)
    expect(first.backfilled).toBe(2)
    expect(first.stoppedAfterRefundId).toBeNull()
    // refund_a: -5.40; refund_b: earnings 18, cap 33.33, refund 20 -> -10.80.
    const byRefund = Object.fromEntries(
      state.adjustments.map((row) => [row.refundId, row.amount.toFixed(2)])
    )
    expect(byRefund).toEqual({ refund_a: '-5.40', refund_b: '-10.80' })

    const second = await reconcileClawbacks(asLedger(client), { apply: true })
    expect(second.missing).toBe(0)
    expect(second.backfilled).toBe(0)
    expect(state.adjustments).toHaveLength(2)
  })

  it('detects a mismatched amount and does not alter it', async () => {
    // Different items so their histories do not entangle.
    const refundA = makeRefund({ id: 'refund_a', orderItem: ITEM_A })
    const refundB = makeRefund({
      id: 'refund_b',
      orderItem: ITEM_B,
      orderItemId: 'item_b',
      amount: new Prisma.Decimal(6.66),
    })

    const { client, state } = buildFake({
      refunds: [refundA, refundB],
      adjustments: [
        makeAdjustment({ refundId: 'refund_a', idempotencyKey: 'refund-clawback:refund_a', amount: new Prisma.Decimal(-5.4) }),
        makeAdjustment({ id: 'adj_2', refundId: 'refund_b', orderItemId: 'item_b', idempotencyKey: 'refund-clawback:refund_b', amount: new Prisma.Decimal(-9.99) }),
      ],
    })

    const report = await reconcileClawbacks(asLedger(client), { apply: true })

    expect(report.alreadyRecorded).toBe(1)
    expect(report.mismatches).toBe(1)
    expect(report.mismatchedRefundIds).toEqual(['refund_b'])
    expect(report.backfilled).toBe(0)
    // refund_a: -5.40 matches its entry; refund_b: earnings 18, cap 33.33,
    // refund 6.66 -> target -3.60 vs recorded -9.99.
    expect(report.expectedDebitByStore).toEqual({ store_1: '-3.60' })
    expect(report.recordedDebitByStore).toEqual({ store_1: '-15.39' })
    // The mismatched entry is never updated or deleted, and nothing new is
    // created: the two pre-existing entries are untouched.
    expect(state.adjustments).toHaveLength(2)
    expect(state.adjustments.map((row) => [row.refundId, row.amount.toFixed(2)]).sort()).toEqual([
      ['refund_a', '-5.40'],
      ['refund_b', '-9.99'],
    ])
    expect(client.vendorBalanceAdjustment.update).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.delete).not.toHaveBeenCalled()
  })

  it('cursor pagination covers more refunds than the batch size without skipping or repeating any', async () => {
    const refunds = Array.from({ length: 7 }, (_, i) =>
      makeRefund({ id: `refund_${String(i + 1).padStart(2, '0')}`, orderItem: ITEM_A })
    )

    const { client } = buildFake({ refunds })

    const report = await reconcileClawbacks(asLedger(client), { limit: 3 })

    expect(report.refundsChecked).toBe(7)
    expect(report.missingRefundIds).toHaveLength(7)
    expect(new Set(report.missingRefundIds).size).toBe(7)

    // Page 2 and 3 must have used a cursor.
    const calls = (client.refund.findMany as any).mock.calls.map((call: any[]) => call[0])
    const pageCalls = calls.filter((call: any) => call.cursor)
    expect(pageCalls).toHaveLength(2)
    expect(pageCalls[0].cursor).toEqual({ id: 'refund_03' })
    expect(pageCalls[0].skip).toBe(1)
    expect(pageCalls[1].cursor).toEqual({ id: 'refund_06' })
    expect(pageCalls[1].skip).toBe(1)
  })

  it('stops on an unexpected error and reports progress', async () => {
    // Each refund lives on its own order item so their histories do not
    // entangle under the "all other refunds on the item" semantics.
    const stopOrder = {
      id: 'order_2',
      total: 60,
      items: [...ORDER.items, { id: 'item_d', price: 40, quantity: 1 }],
      payment: ORDER.payment,
    }
    const ITEM_D = { id: 'item_d', price: 40, quantity: 1, vendorEarnings: 36, order: stopOrder, product: { store: { id: 'store_1', userId: 'vendor_1' } } }
    const refunds = [
      makeRefund({ id: 'refund_a', orderItem: ITEM_A, orderItemId: 'item_a', amount: new Prisma.Decimal(1) }),
      makeRefund({ id: 'refund_b', orderItem: ITEM_B, orderItemId: 'item_b', amount: new Prisma.Decimal(1) }),
      makeRefund({ id: 'refund_c', orderItem: ITEM_D, orderItemId: 'item_d', amount: new Prisma.Decimal(1) }),
    ]

    const { client, state } = buildFake({ refunds, throwOnRefundId: 'refund_c' })

    const report = await reconcileClawbacks(asLedger(client), { apply: true })

    expect(report.refundsChecked).toBe(3)
    expect(report.backfilled).toBe(2)
    expect(report.stoppedAfterRefundId).toBe('refund_c')
    expect(state.adjustments).toHaveLength(2)
  })

  it('report contains only ids, counts and amounts', async () => {
    const { client } = buildFake({ refunds: [makeRefund()] })

    const report = await reconcileClawbacks(asLedger(client))

    expect(Object.keys(report)).toEqual(REPORT_KEYS)
    const counts: (keyof ClawbackReconcileReport)[] = [
      'refundsChecked',
      'alreadyRecorded',
      'missing',
      'mismatches',
      'skipped',
      'backfilled',
    ]
    for (const key of counts) {
      expect(typeof (report as Record<string, unknown>)[key]).toBe('number')
    }
    expect(typeof report.skippedReasons).toBe('object')
    const raw = report as Record<string, unknown>
    for (const key of ['missingRefundIds', 'mismatchedRefundIds']) {
      expect(Array.isArray(raw[key])).toBe(true)
      for (const id of raw[key] as unknown[]) {
        expect(typeof id).toBe('string')
      }
    }
    expect(report.stoppedAfterRefundId === null || typeof report.stoppedAfterRefundId === 'string').toBe(
      true
    )
    for (const map of [report.expectedDebitByStore, report.recordedDebitByStore]) {
      for (const value of Object.values(map)) {
        expect(typeof value).toBe('string')
      }
    }
  })

  it('sinceDate excludes older refunds', async () => {
    const refunds = [
      makeRefund({ id: 'refund_a', createdAt: new Date('2026-10-20T00:00:00.000Z') }),
      makeRefund({ id: 'refund_b', createdAt: new Date('2026-10-21T00:00:00.000Z') }),
      makeRefund({ id: 'refund_c', createdAt: new Date('2026-10-22T00:00:00.000Z') }),
    ]

    const { client } = buildFake({ refunds })

    const report = await reconcileClawbacks(asLedger(client), {
      sinceDate: new Date('2026-10-21T00:00:00.000Z'),
    })

    expect(report.refundsChecked).toBe(2)
    expect(report.missingRefundIds).toEqual(['refund_b', 'refund_c'])
  })
})
