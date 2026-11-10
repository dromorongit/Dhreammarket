import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  recordFulfillmentEvent: vi.fn(),
  createAuditLog: vi.fn(),
  releaseStock: vi.fn(),
  restoreManualSaleStock: vi.fn(),
  createNotification: vi.fn(),
  reverseInfluencerOrderCashback: vi.fn(),
  notifySuperAdminsRefundRequested: vi.fn(),
  invalidateSalesSummaryCaches: vi.fn(),
  isCancellationPolicyEnabled: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: mocks.verifyToken }))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: mocks.recordFulfillmentEvent }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }))
vi.mock('@/lib/stock-reservation', () => ({
  releaseStock: mocks.releaseStock,
  restoreManualSaleStock: mocks.restoreManualSaleStock,
}))
vi.mock('@/lib/notifications', () => ({ createNotification: mocks.createNotification }))
vi.mock('@/lib/influencer/order-cashback', () => ({
  reverseInfluencerOrderCashback: mocks.reverseInfluencerOrderCashback,
}))
vi.mock('@/lib/refunds/admin-notify', () => ({
  notifySuperAdminsRefundRequested: mocks.notifySuperAdminsRefundRequested,
}))
vi.mock('@/lib/sales-summary-cache', () => ({
  invalidateSalesSummaryCaches: mocks.invalidateSalesSummaryCaches,
}))
vi.mock('@/lib/feature-flags', () => ({
  isCancellationPolicyEnabled: mocks.isCancellationPolicyEnabled,
}))

import { getPrisma } from '@/lib/prisma'
import { PATCH } from '@/app/api/orders/[orderId]/cancel/route'

const mockGetPrisma = vi.mocked(getPrisma)

const NOW = new Date('2026-01-01T12:00:00Z')

function baseOrder(): any {
  return {
    id: 'order_1',
    userId: 'user_1',
    status: 'PENDING',
    paymentStatus: 'PAID',
    total: 100,
    subtotal: 100,
    shipping: 0,
    tax: 0,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    paymentConfirmedAt: new Date('2026-01-01T10:00:00Z'),
    source: 'ONLINE',
    orderType: 'NORMAL',
    fulfillmentStatus: 'PENDING',
    walletAmountApplied: 0,
    deletedAt: null,
    items: [
      {
        id: 'item_1',
        productId: 'p1',
        productVariantId: null,
        quantity: 1,
        price: 100,
        shippedAt: null,
        product: { store: { id: 's1', userId: 'vendor_1', name: 'Store' } },
      },
    ],
    payment: {
      id: 'pay_1',
      amount: 105,
      currency: 'GHS',
      status: 'PAID',
      reference: 'DHV-REF',
      paystackRef: 'ps_ref',
      message: null,
      createdAt: NOW,
    },
  }
}

function baseUser(): any {
  return { id: 'user_1', cancellationBlockedUntil: null }
}

function buildMockPrisma(order: any, user: any, cutover: Date | null = null) {
  const createCalls: any[] = []
  const updateCalls: any[] = []
  let txCancellations: any[] = []
  let updateManyResults: { count: number }[] = [{ count: 1 }]
  let updateManyCallIndex = 0

  const mockPrisma = {
    $transaction: vi.fn(async (callback: any) => {
      const tx = {
        $queryRaw: vi.fn(async () => []),
        order: {
          findFirst: vi.fn(async () => order),
          updateMany: vi.fn(async () => {
            const result = updateManyResults[updateManyCallIndex] ?? { count: 1 }
            updateManyCallIndex++
            return result
          }),
        },
        platformPolicy: { findUnique: vi.fn(async () => ({ systemCutoverTimestamp: cutover })) },
        user: {
          findUnique: vi.fn(async () => user),
          update: vi.fn(async (args: any) => {
            updateCalls.push(args)
            return { id: user.id, ...args.data }
          }),
        },
        customerCancellation: {
          create: vi.fn(async (args: any) => {
            createCalls.push(args)
            txCancellations.push({ id: 'cc_1', createdAt: new Date(), ...args.data })
            return { id: 'cc_1', ...args.data }
          }),
          findMany: vi.fn(async (args: any) => {
            let rows = txCancellations
            if (args?.where?.createdAt?.gte) {
              const gte = new Date(args.where.createdAt.gte)
              rows = rows.filter((r) => new Date(r.createdAt).getTime() >= gte.getTime())
            }
            if (args?.orderBy?.createdAt === 'asc') {
              rows = [...rows].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              )
            }
            return rows
          }),
          count: vi.fn(async () => txCancellations.length),
        },
      }
      return callback(tx)
    }),
    order: { findFirst: vi.fn(async () => order) },
    customerCancellation: {
      create: vi.fn(async (args: any) => { createCalls.push(args); return { id: 'cc_1', ...args.data } }),
      findMany: vi.fn(async () => txCancellations),
      count: vi.fn(async () => txCancellations.length),
    },
    user: { update: vi.fn(async (args: any) => { updateCalls.push(args); return { id: user.id } }) },
  }
  return {
    mockPrisma,
    get createCalls() { return createCalls },
    get updateCalls() { return updateCalls },
    setCancellations(arr: any[]) { txCancellations = arr },
    setUpdateManyResults(results: { count: number }[]) { updateManyResults = [...results] },
    resetCallIndex() { updateManyCallIndex = 0 },
  }
}

function requestWithToken(body: any) {
  return new NextRequest('http://localhost/api/orders/order_1/cancel', {
    method: 'PATCH',
    headers: { cookie: 'token=token_user_1', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

async function invoke(order: any, user: any, cutover: Date | null = null, flagOn = false, updateManyResults?: { count: number }[]) {
  const ctx = buildMockPrisma(order, user, cutover)
  mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
  mocks.isCancellationPolicyEnabled.mockReturnValue(flagOn)
  if (updateManyResults) {
    ctx.setUpdateManyResults(updateManyResults)
    ctx.resetCallIndex()
  }
  const response = await PATCH(requestWithToken({ reason: 'changed my mind' }), { params: { orderId: 'order_1' } } as any)
  return { response, ctx }
}

describe('PATCH /api/orders/[orderId]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mocks.verifyToken.mockResolvedValue({
      authenticated: true,
      userId: 'user_1',
      role: 'CUSTOMER',
      sessionId: 'sess_1',
    })
    mocks.reverseInfluencerOrderCashback.mockResolvedValue(undefined)
    mocks.recordFulfillmentEvent.mockResolvedValue(undefined)
    mocks.createAuditLog.mockResolvedValue(undefined)
    mocks.releaseStock.mockResolvedValue({ success: true })
    mocks.restoreManualSaleStock.mockResolvedValue({ success: true })
    mocks.createNotification.mockResolvedValue(undefined)
    mocks.notifySuperAdminsRefundRequested.mockResolvedValue(undefined)
    mocks.invalidateSalesSummaryCaches.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancels free within 60 minutes and records a counter row', async () => {
    vi.setSystemTime(NOW)
    const { response, ctx } = await invoke(
      { ...baseOrder(), createdAt: new Date('2026-01-01T11:01:00Z'), paymentConfirmedAt: new Date('2026-01-01T11:01:00Z'), paymentStatus: 'PAID' },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.refundRequested).toBe(true)
    expect(json.free).toBe(true)
    expect(json.feeAmount).toBe(0)
    expect(json.refundAmount).toBe(100)
    expect(ctx.createCalls).toHaveLength(1)
    expect(ctx.createCalls[0].data).toMatchObject({ feeAmount: 0, refundAmount: 100 })
    expect(ctx.updateCalls).toHaveLength(0)
  })

  it('is free at exactly 60 minutes', async () => {
    vi.setSystemTime(NOW)
    const { response } = await invoke(
      { ...baseOrder(), createdAt: new Date('2026-01-01T11:00:00Z'), paymentConfirmedAt: new Date('2026-01-01T11:00:00Z'), paymentStatus: 'PAID' },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    const json = await response.json()
    expect(json.free).toBe(true)
    expect(json.feeAmount).toBe(0)
    expect(json.refundAmount).toBe(100)
  })

  it('charges GHS 5 at 61 minutes', async () => {
    vi.setSystemTime(NOW)
    const { response, ctx } = await invoke(
      { ...baseOrder(), createdAt: new Date('2026-01-01T10:59:00Z'), paymentConfirmedAt: new Date('2026-01-01T10:59:00Z'), paymentStatus: 'PAID' },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    const json = await response.json()
    expect(json.free).toBe(false)
    expect(json.feeAmount).toBe(5)
    expect(json.refundAmount).toBe(95)
    expect(ctx.createCalls[0].data).toMatchObject({ feeAmount: 5, refundAmount: 95 })
  })

  it('fee never exceeds the refund base when the total is under GHS 5', async () => {
    vi.setSystemTime(NOW)
    const { response, ctx } = await invoke(
      {
        ...baseOrder(),
        total: 3,
        createdAt: new Date('2026-01-01T10:59:00Z'),
        paymentConfirmedAt: new Date('2026-01-01T10:59:00Z'),
        paymentStatus: 'PAID',
        items: [{ ...baseOrder().items[0], price: 3 }],
      },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    const json = await response.json()
    expect(json.free).toBe(false)
    expect(json.feeAmount).toBe(3)
    expect(json.refundAmount).toBe(0)
  })

  it('never puts the Paystack processing fee into refundAmount', async () => {
    vi.setSystemTime(NOW)
    const { response } = await invoke(
      { ...baseOrder(), total: 100, createdAt: new Date('2026-01-01T10:59:00Z'), paymentConfirmedAt: new Date('2026-01-01T10:59:00Z'), paymentStatus: 'PAID' },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    const json = await response.json()
    // refundAmount derives from the product total (100) minus the cancellation fee (5),
    // not from the amount paid including the Paystack fee (105).
    expect(json.refundAmount).toBe(95)
    expect(json.feeAmount).toBe(5)
  })

  it('unpaid cancel: no fee, no counter row, not blocked', async () => {
    vi.setSystemTime(NOW)
    const { response, ctx } = await invoke(
      { ...baseOrder(), paymentStatus: 'PENDING' },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.refundRequested).toBe(false)
    expect(ctx.createCalls).toHaveLength(0)
    expect(ctx.updateCalls).toHaveLength(0)
  })

  it('manual order: no fee, no counter row, not blocked', async () => {
    vi.setSystemTime(NOW)
    const { response, ctx } = await invoke(
      { ...baseOrder(), source: 'MANUAL', paymentStatus: 'PAID' },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.refundRequested).toBe(false)
    expect(ctx.createCalls).toHaveLength(0)
    expect(ctx.updateCalls).toHaveLength(0)
  })

  it('rejects an order with a shipped item', async () => {
    vi.setSystemTime(NOW)
    const { response } = await invoke(
      { ...baseOrder(), items: [{ ...baseOrder().items[0], shippedAt: new Date('2026-01-01T11:00:00Z') }] },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    expect(response.status).toBe(400)
  })

  it('rejects shipped / delivered / completed / cancelled order statuses', async () => {
    for (const status of ['SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as const) {
      const { response } = await invoke(
        { ...baseOrder(), status, paymentStatus: 'PAID' },
        baseUser(),
        new Date('2026-01-01T00:00:00Z'),
        true
      )
      expect(response.status).toBe(400)
    }
  })

  it('concurrent double cancel creates one row and one cancellation', async () => {
    vi.setSystemTime(NOW)
    const ctx = buildMockPrisma(baseOrder(), baseUser(), new Date('2026-01-01T00:00:00Z'))
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    ctx.setUpdateManyResults([{ count: 1 }, { count: 0 }])
    ctx.resetCallIndex()

    const first = await PATCH(requestWithToken({ reason: 'a' }), { params: { orderId: 'order_1' } } as any)
    expect(first.status).toBe(200)

    const second = await PATCH(requestWithToken({ reason: 'b' }), { params: { orderId: 'order_1' } } as any)
    expect(second.status).toBe(400)

    expect(ctx.createCalls).toHaveLength(1)
  })

  it('4th cancellation within 30 days succeeds and sets the block (clean)', async () => {
    vi.setSystemTime(NOW)
    const prior = [
      { id: 'cc_a', createdAt: new Date('2026-01-01T09:00:00Z') },
      { id: 'cc_b', createdAt: new Date('2026-01-01T09:30:00Z') },
      { id: 'cc_c', createdAt: new Date('2026-01-01T10:00:00Z') },
    ]
    const ctx = buildMockPrisma(baseOrder(), baseUser(), new Date('2026-01-01T00:00:00Z'))
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    ctx.setCancellations(prior)
    const response = await PATCH(requestWithToken({ reason: 'a' }), { params: { orderId: 'order_1' } } as any)
    expect(response.status).toBe(200)
    expect(ctx.updateCalls).toHaveLength(1)
    // The 4th row is the current cancellation (created at now), so the block
    // runs from now plus 3 calendar months.
    expect(ctx.updateCalls[0].data.cancellationBlockedUntil).toEqual(
      new Date('2026-04-01T12:00:00Z')
    )
  })

  it('5th cancellation is rejected 403 with the blocked date', async () => {
    vi.setSystemTime(NOW)
    const { response } = await invoke(
      baseOrder(),
      { ...baseUser(), cancellationBlockedUntil: new Date('2026-06-01T00:00:00Z') },
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error).toContain('2026-06-01')
  })

  it('a cancellation on day 31 is outside the 30-day window', async () => {
    vi.setSystemTime(NOW)
    const prior = [
      { id: 'cc_a', createdAt: new Date('2025-11-30T09:00:00Z') },
      { id: 'cc_b', createdAt: new Date('2025-12-15T09:00:00Z') },
      { id: 'cc_c', createdAt: new Date('2025-12-20T09:00:00Z') },
    ]
    const ctx = buildMockPrisma(baseOrder(), baseUser(), new Date('2026-01-01T00:00:00Z'))
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    ctx.setCancellations(prior)
    const response = await PATCH(requestWithToken({ reason: 'a' }), { params: { orderId: 'order_1' } } as any)
    expect(response.status).toBe(200)
    // Only Dec 15 + Dec 20 fall in the window; plus this one = 3 < 4, no block.
    expect(ctx.updateCalls).toHaveLength(0)
    expect(ctx.createCalls).toHaveLength(1)
  })

  it('free cancellations count toward the 30-day total', async () => {
    vi.setSystemTime(NOW)
    const prior = [
      { id: 'cc_a', createdAt: new Date('2026-01-01T09:00:00Z'), feeAmount: 0 },
      { id: 'cc_b', createdAt: new Date('2026-01-01T09:30:00Z'), feeAmount: 0 },
      { id: 'cc_c', createdAt: new Date('2026-01-01T10:00:00Z'), feeAmount: 0 },
    ]
    const ctx = buildMockPrisma(
      { ...baseOrder(), createdAt: new Date('2026-01-01T11:00:00Z'), paymentConfirmedAt: new Date('2026-01-01T11:00:00Z') },
      baseUser(),
      new Date('2026-01-01T00:00:00Z')
    )
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    ctx.setCancellations(prior)
    const response = await PATCH(requestWithToken({ reason: 'a' }), { params: { orderId: 'order_1' } } as any)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.free).toBe(true)
    expect(ctx.updateCalls).toHaveLength(1)
  })

  it('flag off behaves exactly as before: no counter row, no block', async () => {
    vi.setSystemTime(NOW)
    const { response, ctx } = await invoke(
      { ...baseOrder(), createdAt: new Date('2026-01-01T10:00:00Z'), paymentStatus: 'PAID' },
      baseUser(),
      null,
      false
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.refundRequested).toBe(true)
    expect(ctx.createCalls).toHaveLength(0)
    expect(ctx.updateCalls).toHaveLength(0)
  })

  it('pre-cutover order behaves as before even with the flag on', async () => {
    vi.setSystemTime(NOW)
    const { response, ctx } = await invoke(
      { ...baseOrder(), createdAt: new Date('2025-12-01T10:00:00Z'), paymentStatus: 'PAID' },
      baseUser(),
      new Date('2026-01-01T00:00:00Z'),
      true
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.refundRequested).toBe(true)
    expect(ctx.createCalls).toHaveLength(0)
    expect(ctx.updateCalls).toHaveLength(0)
  })
})
