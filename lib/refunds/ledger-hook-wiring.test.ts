import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/paystack', () => ({
  createPaystackRefund: vi.fn(),
  listPaystackRefunds: vi.fn(),
}))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/stock-reservation', () => ({
  releaseStock: vi.fn().mockResolvedValue({ success: true }),
  reserveStock: vi.fn(),
}))
vi.mock('@/lib/influencer/order-cashback', () => ({
  reverseInfluencerOrderCashback: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/email', () => ({ sendRefundConfirmationEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  logDebug: vi.fn(),
}))

const mockRecordRefundClawback = vi.hoisted(() => vi.fn())
const mockNotifyProcessed = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/lib/refunds/refund-email', () => ({
  notifyRefundProcessed: mockNotifyProcessed,
}))

// The real shadow-hook is under test; it calls recordRefundClawback, which we spy on.
vi.mock('@/lib/ledger/corrective-ledger', () => ({
  recordRefundClawback: mockRecordRefundClawback,
}))

import { getPrisma } from '@/lib/prisma'
import { createPaystackRefund, listPaystackRefunds } from '@/lib/paystack'
import { createRefund, checkRefundStatus } from '@/lib/refunds/refund-service'
import { reconcileRefundsForPayment } from '@/lib/webhooks/refund-webhook-handler'

const mockCreateRefund = vi.mocked(createPaystackRefund)
const mockListRefunds = vi.mocked(listPaystackRefunds)

const ADMIN = { triggeredByUserId: 'admin_1', triggeredByRole: 'SUPER_ADMIN' as const }

const ORDER_ID = 'order_1'
const PAYMENT_ID = 'pay_1'
const PAYMENT_REF = 'DHV-REF1'
const ITEM_A_ID = 'item_a'
const ITEM_B_ID = 'item_b'
const REFUND_ID = 'refund_1'
const IDEMPOTENCY_KEY = 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff'

const origFlag = process.env.LEDGER_SHADOW_WRITE

function enableFlag() {
  process.env.LEDGER_SHADOW_WRITE = 'true'
}

function disableFlag() {
  delete process.env.LEDGER_SHADOW_WRITE
}

function baseRefund(overrides: Record<string, any> = {}) {
  return {
    id: REFUND_ID,
    paymentId: PAYMENT_ID,
    orderItemId: ITEM_A_ID,
    orderId: ORDER_ID,
    amount: 30,
    currency: 'GHS',
    status: 'PENDING',
    paystackRefundId: null,
    paystackStatus: null,
    failureReason: null,
    processedAt: null,
    retryCount: 0,
    lastRetryAt: null,
    createdAt: new Date('2026-10-20T10:00:00.000Z'),
    idempotencyKey: IDEMPOTENCY_KEY,
    ...overrides,
  }
}

function baseOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    userId: 'user_1',
    total: 100,
    walletAmountApplied: 0,
    paymentStatus: 'PAID',
    source: 'ONLINE',
    user: { id: 'user_1', email: 'customer@example.test', profile: { firstName: 'Ada' } },
    payment: { id: PAYMENT_ID, amount: 100, status: 'PAID', paystackRef: PAYMENT_REF, reference: PAYMENT_REF },
    items: [
      { id: ITEM_A_ID, productId: 'p1', quantity: 1, price: 30 },
      { id: ITEM_B_ID, productId: 'p2', quantity: 1, price: 70 },
    ],
    refunds: [],
    ...overrides,
  }
}

function paystackRefundProcessed(overrides: Record<string, any> = {}) {
  return {
    id: '9001',
    amount: 3000,
    currency: 'GHS',
    status: 'processed',
    createdAt: new Date('2026-10-20T10:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function buildPrisma() {
  const state = { order: baseOrder(), refunds: [] as any[] }
  const order = state.order

  const refundFindUnique = vi.fn(async ({ where }: any = {}) => {
    if (!where) return null
    const row =
      where.id
        ? state.refunds.find((r: any) => r.id === where.id)
        : where.idempotencyKey
          ? state.refunds.find((r: any) => r.idempotencyKey === where.idempotencyKey)
          : null
    if (!row) return null
    return {
      ...row,
      currency: row.currency ?? 'GHS',
      payment: { id: row.paymentId, paystackRef: PAYMENT_REF, orderId: ORDER_ID },
      orderItem: { productId: 'p1', quantity: 1, price: 30 },
    }
  })

  const refundFindMany = vi.fn(async (arg: any = {}) => {
    const where = arg?.where ?? {}
    if (where.idempotencyKey?.in) {
      const inList = where.idempotencyKey.in as string[]
      return state.refunds.filter((r: any) => inList.includes(r.idempotencyKey))
    }
    if (where.paymentId !== undefined && where.status !== undefined) {
      const raw = where.status
      const statuses = Array.isArray(raw) ? raw : raw?.in ?? [raw]
      const found = state.refunds.filter((r: any) => r.paymentId === where.paymentId && statuses.includes(r.status))
      return found
    }
    if (where.status !== undefined) {
      const raw = where.status
      const statuses = Array.isArray(raw) ? raw : raw?.in ?? [raw]
      return state.refunds.filter((r: any) => statuses.includes(r.status))
    }
    return state.refunds
  })

  const refundCreate = vi.fn(async ({ data }: any = {}) => {
    const row = {
      id: REFUND_ID,
      paystackRefundId: null,
      paystackStatus: null,
      failureReason: null,
      processedAt: null,
      retryCount: 0,
      lastRetryAt: null,
      createdAt: new Date(),
      ...data,
    }
    state.refunds.push(row)
    return row
  })

  const refundUpdate = vi.fn(async ({ where, data }: any = {}) => {
    const row = state.refunds.find((r: any) => r.id === where.id)
    if (row) Object.assign(row, data)
    return row
  })

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    refund: { findUnique: refundFindUnique, findMany: refundFindMany, create: refundCreate, update: refundUpdate },
    orderItem: { findMany: vi.fn().mockResolvedValue(order.items) },
    payment: { findUnique: vi.fn(async ({ where }: any = {}) => (where?.id === PAYMENT_ID ? order.payment : null)) },
  }

  const prisma = {
    order: {
      findUnique: vi.fn(async () => ({
        ...order,
        payment: order.payment,
        items: order.items,
        refunds: [...state.refunds],
        user: order.user,
      })),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn(async ({ where, data }: any = {}) => {
        if (
          order.paymentStatus === 'PAID' &&
          (where?.paymentStatus === 'PAID' || where?.paymentStatus?.in?.includes('PAID'))
        ) {
          Object.assign(order, data)
          return { count: 1 }
        }
        return { count: 0 }
      }),
    },
    payment: { update: vi.fn().mockResolvedValue({}) },
    refund: { findUnique: refundFindUnique, findMany: refundFindMany, create: refundCreate, update: refundUpdate },
    orderItem: { findMany: vi.fn().mockResolvedValue(order.items) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __state: state,
  }

  vi.mocked(getPrisma).mockReturnValue(prisma as never)
  return { prisma, state, refundUpdate }
}

beforeEach(() => {
  vi.resetAllMocks()
  mockCreateRefund.mockResolvedValue({
    success: true,
    refund: paystackRefundProcessed({ id: 9001 }),
  } as never)
  mockListRefunds.mockResolvedValue({ success: true, refunds: [] } as never)
  disableFlag()
})

afterEach(() => {
  process.env.LEDGER_SHADOW_WRITE = origFlag
})

function stateOf(prisma: any) {
  return (prisma as any).__state
}

// ---- Path 1: createRefund -------------------------------------------------

describe('path 1 - createRefund', () => {
  it('flag on: calls the hook once with the prisma client and the new refund id', async () => {
    enableFlag()
    const { prisma } = buildPrisma()

    const result = await createRefund({
      orderId: ORDER_ID,
      items: [{ orderItemId: ITEM_A_ID, amount: 30 }],
      source: 'MANUAL',
      reference: IDEMPOTENCY_KEY,
      actor: ADMIN,
    })

    expect(result.refunds).toHaveLength(1)
    expect(result.refunds[0].status).toBe('PROCESSED')
    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    expect(mockRecordRefundClawback).toHaveBeenCalledWith(prisma, REFUND_ID)
  })

  it('flag off: behaves exactly as before and the ledger is never touched', async () => {
    const { prisma } = buildPrisma()

    const result = await createRefund({
      orderId: ORDER_ID,
      items: [{ orderItemId: ITEM_A_ID, amount: 30 }],
      source: 'MANUAL',
      reference: IDEMPOTENCY_KEY,
      actor: ADMIN,
    })

    expect(result.refunds[0].status).toBe('PROCESSED')
    expect(result.orderRefunded).toBe(false)
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
  })

  it('flag on: a hook that throws does not change the settlement result', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    mockRecordRefundClawback.mockImplementation(() => {
      throw new Error('ledger is down')
    })

    const result = await createRefund({
      orderId: ORDER_ID,
      items: [{ orderItemId: ITEM_A_ID, amount: 30 }],
      source: 'MANUAL',
      reference: IDEMPOTENCY_KEY,
      actor: ADMIN,
    })

    expect(result.refunds[0].status).toBe('PROCESSED')
    expect(result.orderRefunded).toBe(false)
    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('flag on: a hook that rejects does not change the settlement result', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    mockRecordRefundClawback.mockRejectedValue('rejection with no error')

    const result = await createRefund({
      orderId: ORDER_ID,
      items: [{ orderItemId: ITEM_A_ID, amount: 30 }],
      source: 'MANUAL',
      reference: IDEMPOTENCY_KEY,
      actor: ADMIN,
    })

    expect(result.refunds[0].status).toBe('PROCESSED')
    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('a replay of an already-created refund does not trigger the hook again', async () => {
    enableFlag()
    const { prisma } = buildPrisma()

    await createRefund({
      orderId: ORDER_ID,
      items: [{ orderItemId: ITEM_A_ID, amount: 30 }],
      source: 'MANUAL',
      reference: IDEMPOTENCY_KEY,
      actor: ADMIN,
    })
    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    vi.clearAllMocks()

    const replay = await createRefund({
      orderId: ORDER_ID,
      items: [{ orderItemId: ITEM_A_ID, amount: 30 }],
      source: 'MANUAL',
      reference: IDEMPOTENCY_KEY,
      actor: ADMIN,
    })

    expect(replay.alreadyProcessed).toBe(true)
    expect(mockCreateRefund).not.toHaveBeenCalled()
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
  })
})

// ---- Path 2: checkRefundStatus reconcile branch ---------------------------

describe('path 2 - checkRefundStatus reconcile', () => {
  it('flag on: calls the hook once when this call transitions the row to PROCESSED', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PENDING', paystackRefundId: '9001' }))
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefundProcessed()] } as never)

    const result = await checkRefundStatus(REFUND_ID, ADMIN)

    expect(result.outcome).toBe('RECONCILED')
    expect(result.status).toBe('PROCESSED')
    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    expect(mockRecordRefundClawback).toHaveBeenCalledWith(prisma, REFUND_ID)
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('flag off: the ledger is never touched', async () => {
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PENDING', paystackRefundId: '9001' }))
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefundProcessed()] } as never)

    const result = await checkRefundStatus(REFUND_ID, ADMIN)

    expect(result.status).toBe('PROCESSED')
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
  })

  it('hook rejection does not change the result or the final status', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PENDING', paystackRefundId: '9001' }))
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefundProcessed()] } as never)
    mockRecordRefundClawback.mockRejectedValue(new Error('down'))

    const result = await checkRefundStatus(REFUND_ID, ADMIN)

    expect(result.outcome).toBe('RECONCILED')
    expect(result.status).toBe('PROCESSED')
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('an already PROCESSED refund returns early and never triggers the hook', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PROCESSED', paystackRefundId: '9001' }))

    const result = await checkRefundStatus(REFUND_ID, ADMIN)

    expect(result.outcome).toBe('ALREADY_FINAL')
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
    expect(mockListRefunds).not.toHaveBeenCalled()
  })
})

// ---- Path 3: checkRefundStatus RESUBMIT branch ----------------------------

describe('path 3 - checkRefundStatus RESUBMIT', () => {
  it('flag on: calls the hook once after the transaction commits', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(
      baseRefund({ status: 'PENDING', paystackRefundId: null, createdAt: new Date(Date.now() - 15 * 60 * 1000) })
    )
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: paystackRefundProcessed({ id: 9002 }),
    } as never)

    const result = await checkRefundStatus(REFUND_ID, ADMIN, 'RESUBMIT')

    expect(result.outcome).toBe('RESUBMITTED')
    expect(result.status).toBe('PROCESSED')
    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    expect(mockRecordRefundClawback).toHaveBeenCalledWith(prisma, REFUND_ID)
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('flag off: the ledger is never touched', async () => {
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(
      baseRefund({ status: 'PENDING', paystackRefundId: null, createdAt: new Date(Date.now() - 15 * 60 * 1000) })
    )
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: paystackRefundProcessed({ id: 9002 }),
    } as never)

    const result = await checkRefundStatus(REFUND_ID, ADMIN, 'RESUBMIT')

    expect(result.status).toBe('PROCESSED')
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
  })

  it('hook rejection does not change the result or the final status', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(
      baseRefund({ status: 'PENDING', paystackRefundId: null, createdAt: new Date(Date.now() - 15 * 60 * 1000) })
    )
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: paystackRefundProcessed({ id: 9002 }),
    } as never)
    mockRecordRefundClawback.mockRejectedValue({ code: 'P2034' })

    const result = await checkRefundStatus(REFUND_ID, ADMIN, 'RESUBMIT')

    expect(result.outcome).toBe('RESUBMITTED')
    expect(result.status).toBe('PROCESSED')
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('an already PROCESSED refund returns early and never triggers the hook', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PROCESSED', paystackRefundId: null }))

    const result = await checkRefundStatus(REFUND_ID, ADMIN, 'RESUBMIT')

    expect(result.outcome).toBe('ALREADY_FINAL')
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
    expect(mockCreateRefund).not.toHaveBeenCalled()
  })
})

// ---- Path 4: refund webhook reconcileRefundsForPayment --------------------

describe('path 4 - webhook reconcileRefundsForPayment', () => {
  it('flag on: calls the hook once with the reconciled refund id', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PENDING' }))
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefundProcessed()] } as never)

    const summary = await reconcileRefundsForPayment(PAYMENT_ID, [paystackRefundProcessed() as never])

    expect(summary.reconciled).toBe(1)
    expect(summary.attached).toBe(1)
    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    expect(mockRecordRefundClawback).toHaveBeenCalledWith(prisma, REFUND_ID)
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('flag off: behaves exactly as before and the ledger is never touched', async () => {
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PENDING' }))
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefundProcessed()] } as never)

    const summary = await reconcileRefundsForPayment(PAYMENT_ID, [paystackRefundProcessed() as never])

    expect(summary.reconciled).toBe(1)
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
  })

  it('hook rejection does not change the summary or the final status', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PENDING' }))
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefundProcessed()] } as never)
    mockRecordRefundClawback.mockImplementation(() => {
      throw new Error('ledger down')
    })

    const summary = await reconcileRefundsForPayment(PAYMENT_ID, [paystackRefundProcessed() as never])

    expect(summary.reconciled).toBe(1)
    expect(stateOf(prisma).refunds[0].status).toBe('PROCESSED')
  })

  it('a refund that is already PROCESSED is never reconciled and never triggers the hook', async () => {
    enableFlag()
    const { prisma } = buildPrisma()
    stateOf(prisma).refunds.push(baseRefund({ status: 'PROCESSED' }))
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefundProcessed()] } as never)

    const summary = await reconcileRefundsForPayment(PAYMENT_ID, [paystackRefundProcessed() as never])

    expect(summary.reconciled).toBe(0)
    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
  })
})
