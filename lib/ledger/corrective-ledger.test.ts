import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { Caps } from '@/lib/refunds/process-refund'
import * as correctiveLedger from './corrective-ledger'
import {
  getOpenDebitEntries,
  getOpenDebitsForStore,
  recordRefundClawback,
  refundClawbackIdempotencyKey,
  type LedgerClient,
} from './corrective-ledger'

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
  orderItem: FakeOrderItem | null
}

/**
 * The order the fake refund belongs to.
 *
 * One item with a gross of 100.00 and a charged payment of 102.00: the 2.00
 * difference is the pass-through processing fee the customer paid, and it is
 * why the item's refundable cap is 102.00 and NOT its 100.00 gross.
 */
const ORDER = {
  id: 'order_1',
  total: 100,
  items: [{ id: 'item_1', price: 100, quantity: 1 }],
  payment: { id: 'pay_1', amount: 102 },
}

const ORDER_ITEM: FakeOrderItem = {
  id: 'item_1',
  vendorEarnings: 99,
  order: ORDER,
  product: { store: { id: 'store_1', userId: 'vendor_1' } },
}

/** The item's refundable cap, as the refund service itself computes it. */
const ITEM_CAP = 102

function makeRefund(overrides: Partial<FakeRefund> = {}): FakeRefund {
  return {
    id: 'refund_1',
    amount: new Prisma.Decimal(ITEM_CAP),
    currency: 'GHS',
    status: 'PROCESSED',
    orderItem: { ...ORDER_ITEM },
    ...overrides,
  }
}

function makeAdjustment(overrides: Partial<FakeAdjustment> = {}): FakeAdjustment {
  return {
    id: 'adj_1',
    vendorId: 'vendor_1',
    storeId: 'store_1',
    appliedPayoutId: null,
    orderItemId: 'item_1',
    refundId: 'refund_1',
    adjustmentType: 'REFUND_CLAWBACK',
    amount: new Prisma.Decimal(-10),
    appliedAt: null,
    idempotencyKey: null,
    currency: 'GHS',
    note: null,
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    ...overrides,
  }
}

function matchesAdjustment(row: FakeAdjustment, where: Record<string, any> | undefined): boolean {
  if (!where) return true
  if (where.idempotencyKey !== undefined && row.idempotencyKey !== where.idempotencyKey) {
    return false
  }
  if (where.orderItemId !== undefined && row.orderItemId !== where.orderItemId) return false
  if (where.adjustmentType !== undefined && row.adjustmentType !== where.adjustmentType) return false
  if (where.storeId !== undefined && row.storeId !== where.storeId) return false
  if ('appliedPayoutId' in where) {
    if (where.appliedPayoutId === null) {
      if (row.appliedPayoutId !== null) return false
    } else if (row.appliedPayoutId !== where.appliedPayoutId) {
      return false
    }
  }
  return true
}

/**
 * An in-memory fake of the slice of Prisma the ledger uses.
 *
 * No database is involved anywhere in this test file.
 */
function buildFake(options: { refunds?: FakeRefund[]; adjustments?: FakeAdjustment[]; raceOnCreate?: boolean } = {}) {
  const state = {
    refunds: options.refunds ?? [],
    adjustments: options.adjustments ?? [],
    nextId: 0,
    raceOnCreate: options.raceOnCreate ?? false,
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

  const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`idempotencyKey`)',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['idempotencyKey'] },
      }
    )

  const client = {
    vendorBalanceAdjustment: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        return state.adjustments.find((row) => matchesAdjustment(row, where)) ?? null
      }),
      findMany: vi.fn(async ({ where }: any = {}) => {
        return state.adjustments.filter((row) => matchesAdjustment(row, where))
      }),
      create: vi.fn(async ({ data }: any) => {
        if (state.raceOnCreate) {
          // Another transaction committed the same row first: the unique index
          // rejects this insert.
          state.adjustments.push(buildRow(data))
          throw uniqueViolation()
        }
        if (
          data.idempotencyKey &&
          state.adjustments.some((row) => row.idempotencyKey === data.idempotencyKey)
        ) {
          throw uniqueViolation()
        }
        const row = buildRow(data)
        state.adjustments.push(row)
        return row
      }),
      // The ledger is append-only: these must never be called.
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    refund: {
      findUnique: vi.fn(async ({ where }: any = {}) => {
        return state.refunds.find((row) => row.id === where?.id) ?? null
      }),
      findMany: vi.fn(async ({ where }: any = {}) => {
        return state.refunds.filter((row) => {
          if (where?.orderItemId && row.orderItem?.id !== where.orderItemId) return false
          if (where?.status && row.status !== where.status) return false
          return true
        })
      }),
    },
  }

  return { client, state }
}

function asLedger(client: unknown): LedgerClient {
  return client as LedgerClient
}

describe('recordRefundClawback', () => {
  it('creates one open debit for a processed refund', async () => {
    const { client, state } = buildFake({ refunds: [makeRefund()] })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.status).toBe('created')
    expect(result.idempotencyKey).toBe('refund-clawback:refund_1')
    expect(result.entryId).toBe('adj_1')
    // The whole cap was refunded, so the vendor loses exactly its earnings.
    expect(result.amount?.toFixed(2)).toBe('-99.00')

    expect(state.adjustments).toHaveLength(1)
    const entry = state.adjustments[0]
    expect(entry.amount.toFixed(2)).toBe('-99.00')
    expect(entry.appliedPayoutId).toBeNull()
    expect(entry.appliedAt).toBeNull()
    expect(entry.adjustmentType).toBe('REFUND_CLAWBACK')
    expect(entry.idempotencyKey).toBe('refund-clawback:refund_1')
    expect(entry.vendorId).toBe('vendor_1')
    expect(entry.storeId).toBe('store_1')
    expect(entry.orderItemId).toBe('item_1')
    expect(entry.refundId).toBe('refund_1')
    expect(entry.currency).toBe('GHS')
  })

  it('never writes customer data into the note', async () => {
    const { client, state } = buildFake({ refunds: [makeRefund()] })

    await recordRefundClawback(asLedger(client), 'refund_1')

    const note = state.adjustments[0].note ?? ''
    expect(note).toContain('refund_1')
    expect(note).toContain('item_1')
    expect(note).not.toMatch(/@|email|phone|name/i)
  })

  it('reports already_recorded on the second call and creates nothing', async () => {
    const { client, state } = buildFake({ refunds: [makeRefund()] })

    const first = await recordRefundClawback(asLedger(client), 'refund_1')
    const second = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(first.status).toBe('created')
    expect(second.status).toBe('already_recorded')
    expect(second.entryId).toBe(first.entryId)
    expect(second.amount?.toFixed(2)).toBe('-99.00')
    expect(state.adjustments).toHaveLength(1)
    expect(client.vendorBalanceAdjustment.create).toHaveBeenCalledTimes(1)
  })

  it('resolves a lost create race (P2002) to already_recorded', async () => {
    const { client, state } = buildFake({
      refunds: [makeRefund()],
      raceOnCreate: true,
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.status).toBe('already_recorded')
    expect(result.entryId).toBe('adj_1')
    expect(result.amount?.toFixed(2)).toBe('-99.00')
    expect(state.adjustments).toHaveLength(1)
  })

  it('skips a refund that is not PROCESSED', async () => {
    for (const status of ['PENDING', 'PROCESSING', 'FAILED', 'NEEDS_ATTENTION']) {
      const { client, state } = buildFake({
        refunds: [makeRefund({ status })],
      })

      const result = await recordRefundClawback(asLedger(client), 'refund_1')

      expect(result.status).toBe('skipped')
      expect(result.reason).toBe('REFUND_NOT_PROCESSED')
      expect(state.adjustments).toHaveLength(0)
      expect(client.vendorBalanceAdjustment.create).not.toHaveBeenCalled()
    }
  })

  it('skips a refund that does not exist', async () => {
    const { client } = buildFake({ refunds: [] })

    const result = await recordRefundClawback(asLedger(client), 'refund_missing')

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('REFUND_NOT_FOUND')
  })

  it('skips when the vendor earnings are unknown, with a reason', async () => {
    const { client, state } = buildFake({
      refunds: [
        makeRefund({
          orderItem: { ...ORDER_ITEM, vendorEarnings: null },
        }),
      ],
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('VENDOR_EARNINGS_UNKNOWN')
    expect(state.adjustments).toHaveLength(0)
  })

  it('skips when the store cannot be resolved', async () => {
    const { client } = buildFake({
      refunds: [
        makeRefund({
          orderItem: { ...ORDER_ITEM, product: { store: null } },
        }),
      ],
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('STORE_NOT_FOUND')
  })

  it('skips when the vendor cannot be resolved', async () => {
    const { client } = buildFake({
      refunds: [
        makeRefund({
          orderItem: {
            ...ORDER_ITEM,
            product: { store: { id: 'store_1', userId: '' } },
          },
        }),
      ],
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('VENDOR_NOT_FOUND')
  })

  it('skips when the refundable cap cannot be determined', async () => {
    const { client, state } = buildFake({
      refunds: [
        makeRefund({
          orderItem: {
            ...ORDER_ITEM,
            order: { ...ORDER, payment: null },
          },
        }),
      ],
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('REFUNDABLE_CAP_UNKNOWN')
    expect(state.adjustments).toHaveLength(0)
  })

  it('produces two entries whose total is the proportional debit for two partial refunds', async () => {
    const refundA = makeRefund({ id: 'refund_a', amount: new Prisma.Decimal(25) })
    const refundB = makeRefund({
      id: 'refund_b',
      amount: new Prisma.Decimal(25),
      status: 'PENDING',
    })
    const { client, state } = buildFake({ refunds: [refundA, refundB] })

    // The first refund processes while the second is still in flight.
    const first = await recordRefundClawback(asLedger(client), 'refund_a')
    expect(first.status).toBe('created')
    // 99 * 25 / 102 = 24.2647... -> 24.26
    expect(first.amount?.toFixed(2)).toBe('-24.26')

    // The second one processes afterwards.
    refundB.status = 'PROCESSED'
    const second = await recordRefundClawback(asLedger(client), 'refund_b')
    expect(second.status).toBe('created')
    // 99 * 50 / 102 = 48.5294... -> 48.53, minus 24.26 -> 24.27
    expect(second.amount?.toFixed(2)).toBe('-24.27')

    expect(state.adjustments).toHaveLength(2)
    const total = state.adjustments.reduce(
      (sum, row) => sum.plus(row.amount.abs()),
      new Prisma.Decimal(0)
    )
    expect(total.toFixed(2)).toBe('48.53')
  })

  it('never updates or deletes an entry', async () => {
    const { client } = buildFake({ refunds: [makeRefund()] })

    await recordRefundClawback(asLedger(client), 'refund_1')

    expect(client.vendorBalanceAdjustment.update).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.updateMany).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.delete).not.toHaveBeenCalled()
    expect(client.vendorBalanceAdjustment.deleteMany).not.toHaveBeenCalled()
  })
})

describe('the refundable cap', () => {
  it('is the item pro-rata share of the charged payment, not the item gross', () => {
    // The very function the refund service enforces the cap with.
    const caps = Caps.forOrder(ORDER)

    expect(caps.itemCap('item_1')).toBe(102)
    // The gross is 100.00; the cap is 102.00 because the charged payment
    // carries the pass-through processing fee.
    expect(caps.itemCap('item_1')).not.toBe(100)
  })

  it('splits the payment between the items in proportion to their gross', () => {
    const twoItems = {
      id: 'order_2',
      total: 200,
      items: [
        { id: 'item_a', price: 100, quantity: 1 },
        { id: 'item_b', price: 100, quantity: 1 },
      ],
      payment: { id: 'pay_2', amount: 204 },
    }

    const caps = Caps.forOrder(twoItems)

    expect(caps.itemCap('item_a')).toBe(102)
    expect(caps.itemCap('item_b')).toBe(102)
  })

  it('makes the ledger claw back the cap-based share, not the gross-based share', async () => {
    // The worked example: gross 100.00, earnings 99.00, cap 102.00, a
    // refund of 51.00 - half of the cap.
    const { client } = buildFake({
      refunds: [makeRefund({ amount: new Prisma.Decimal(51) })],
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    // cap-based:  99 * 51 / 102 = 49.50
    // gross-based: 99 * 51 / 100 = 50.49
    expect(result.amount?.toFixed(2)).toBe('-49.50')
  })

  it('claws back exactly the vendor earnings when the whole cap is refunded', async () => {
    const { client } = buildFake({
      refunds: [makeRefund({ amount: new Prisma.Decimal(ITEM_CAP) })],
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.amount?.toFixed(2)).toBe('-99.00')
  })

  it('never claws back more than the vendor earnings when the cap is over-refunded', async () => {
    const { client } = buildFake({
      refunds: [makeRefund({ amount: new Prisma.Decimal(150) })],
    })

    const result = await recordRefundClawback(asLedger(client), 'refund_1')

    expect(result.amount?.toFixed(2)).toBe('-99.00')
  })
})

describe('getOpenDebitsForStore', () => {
  it('excludes entries that have been applied to a payout and sums the rest', async () => {
    const { client } = buildFake({
      adjustments: [
        makeAdjustment({ id: 'adj_1', amount: new Prisma.Decimal(-10) }),
        makeAdjustment({ id: 'adj_2', amount: new Prisma.Decimal(-5.5) }),
        makeAdjustment({
          id: 'adj_3',
          amount: new Prisma.Decimal(-20),
          appliedPayoutId: 'payout_1',
        }),
        makeAdjustment({
          id: 'adj_4',
          amount: new Prisma.Decimal(-99),
          storeId: 'store_2',
        }),
      ],
    })

    const total = await getOpenDebitsForStore(asLedger(client), 'store_1')

    expect(total.toFixed(2)).toBe('15.50')
  })

  it('returns zero when the store has no open debits', async () => {
    const { client } = buildFake({ adjustments: [] })

    const total = await getOpenDebitsForStore(asLedger(client), 'store_1')

    expect(total.toFixed(2)).toBe('0.00')
  })
})

describe('getOpenDebitEntries', () => {
  it('returns the open entries of the store only', async () => {
    const { client } = buildFake({
      adjustments: [
        makeAdjustment({ id: 'adj_1', amount: new Prisma.Decimal(-10) }),
        makeAdjustment({
          id: 'adj_2',
          amount: new Prisma.Decimal(-20),
          appliedPayoutId: 'payout_1',
        }),
        makeAdjustment({ id: 'adj_3', amount: new Prisma.Decimal(-99), storeId: 'store_2' }),
      ],
    })

    const entries = await getOpenDebitEntries(asLedger(client), 'store_1')

    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('adj_1')
    expect(entries[0].amount.toFixed(2)).toBe('-10.00')
    expect(entries[0].storeId).toBe('store_1')
  })
})

describe('the module surface', () => {
  it('exposes no update or delete function', () => {
    const names = Object.keys(correctiveLedger)
    const forbidden = names.filter((name) =>
      /update|delete|remove|destroy|apply|settle|mark|write|insert|upsert/i.test(name)
    )

    expect(forbidden).toEqual([])
  })

  it('exposes exactly the dormant ledger surface', () => {
    expect(Object.keys(correctiveLedger).sort()).toEqual([
      'REFUND_CLAWBACK_ADJUSTMENT_TYPE',
      'getOpenDebitEntries',
      'getOpenDebitsForStore',
      'isUniqueConstraintViolation',
      'recordRefundClawback',
      'refundClawbackIdempotencyKey',
    ])
  })
})

describe('refundClawbackIdempotencyKey', () => {
  it('is the refund id, prefixed', () => {
    expect(refundClawbackIdempotencyKey('abc123')).toBe('refund-clawback:abc123')
  })
})
