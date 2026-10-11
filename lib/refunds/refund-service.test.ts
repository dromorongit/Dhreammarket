import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))

vi.mock('@/lib/paystack', () => ({
  createPaystackRefund: vi.fn(),
  listPaystackRefunds: vi.fn(),
}))

vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/stock-reservation', () => ({ releaseStock: vi.fn().mockResolvedValue({ success: true }), reserveStock: vi.fn() }))
vi.mock('@/lib/influencer/order-cashback', () => ({ reverseInfluencerOrderCashback: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/email', () => ({ sendRefundConfirmationEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  logDebug: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { createPaystackRefund, listPaystackRefunds } from '@/lib/paystack'
import { sendRefundConfirmationEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { resetRefundEmailsForTest } from '@/lib/refunds/refund-email'
import { createRefund, checkRefundStatus } from '@/lib/refunds/refund-service'
import { RefundError } from '@/lib/refunds/process-refund'

const mockCreateRefund = vi.mocked(createPaystackRefund)
const mockListRefunds = vi.mocked(listPaystackRefunds)
const mockSendRefundEmail = vi.mocked(sendRefundConfirmationEmail)

const ORDER_USER = { email: 'customer@example.test', profile: { firstName: 'Ada' } }

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    userId: 'user_1',
    total: 100,
    walletAmountApplied: 0,
    paymentStatus: 'PAID',
    user: { id: 'user_1', email: 'customer@example.test', profile: { firstName: 'Ada' } },
    payment: { id: 'pay_1', amount: 100, status: 'PAID', paystackRef: 'DHV-REF1', reference: 'DHV-REF1' },
    items: [
      { id: 'item_a', productId: 'p1', quantity: 1, price: 30 },
      { id: 'item_b', productId: 'p2', quantity: 1, price: 70 },
    ],
    refunds: [],
    ...overrides,
  }
}

function buildPrisma(order: Record<string, any>) {
  const state = {
    refunds: [] as any[],
    orders: [] as any[],
    nextId: 0,
  }

  // Shared by the transaction client and the root client so a test that mocks
  // one applies to both.
  const refundFindUnique = vi.fn(async ({ where }: any) => {
    const found =
      where?.id
        ? state.refunds.find((r) => r.id === where.id)
        : where?.idempotencyKey
          ? state.refunds.find((r) => r.idempotencyKey === where.idempotencyKey)
          : null
    // notifyRefundProcessed re-reads the row with its order/customer relation.
    if (found && where?.id) {
      return { ...found, currency: found.currency ?? 'GHS', order: { user: ORDER_USER } }
    }
    return found ?? null
  })

  const refundCreate = vi.fn(async ({ data }: any) => {
    state.nextId += 1
    const row = {
      paystackRefundId: null,
      paystackStatus: null,
      failureReason: null,
      processedAt: null,
      retryCount: 0,
      lastRetryAt: null,
      createdAt: new Date(),
      ...data,
      id: `refund_${state.nextId}`,
    }
    state.refunds.push(row)
    return row
  })

  const refundUpdate = vi.fn(async ({ where, data }: any) => {
    const row = state.refunds.find((r) => r.id === where.id)
    if (row) Object.assign(row, data)
    return row
  })

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    refund: { findUnique: refundFindUnique, create: refundCreate, update: refundUpdate },
  }

  const prisma = {
    order: {
      findUnique: vi.fn(async ({ include }: any = {}) => {
        if (include?.payment) {
          return { ...order, refunds: [...state.refunds] }
        }
        return { ...order, userId: order.userId, payment: order.payment, refunds: [...state.refunds], user: order.user }
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(order, data)
        state.orders.push({ id: order.id, ...data })
        return order
      }),
    },
    payment: { update: vi.fn().mockResolvedValue({}) },
    refund: {
      findUnique: refundFindUnique,
      create: refundCreate,
      update: refundUpdate,
      findMany: vi.fn(async (arg: any = {}) => {
        // Prisma calls arrive as { where: {...} }, so unwrap the where clause
        // before reading filters. Reading it off the argument directly makes
        // every findMany return every row and hides the idempotency check.
        const where = arg?.where ?? {}
        if (where.idempotencyKey?.in) {
          const inList = where.idempotencyKey.in as string[]
          return state.refunds.filter((r) => inList.includes(r.idempotencyKey))
        }
        if (!where.status) return state.refunds
        return state.refunds.filter((r) =>
          typeof where.status === 'object' && where.status !== null && 'in' in where.status
            ? (where.status as { in: string[] }).in.includes(r.status)
            : r.status === where.status
        )
      }),
    },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { create: vi.fn().mockResolvedValue({}) },
    user: { findMany: vi.fn().mockResolvedValue([{ id: 'admin_1' }]) },
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    __state: state,
  }

  return prisma
}

const ADMIN = { triggeredByUserId: 'admin_1', triggeredByRole: 'SUPER_ADMIN' as const }

// notifyRefundProcessed remembers which refunds it has announced, so every test
// starts from a clean slate.
beforeEach(() => {
  resetRefundEmailsForTest()
})

function definiteRejection(message: string, httpStatus: number) {
  return {
    success: false,
    error: { code: 'API_ERROR', message, httpStatus, messageSource: 'PAYSTACK' as const },
  } as never
}

describe('createRefund', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildPrisma(baseOrder())
    vi.mocked(getPrisma).mockReturnValue(prisma as never)
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: {
        id: 9001,
        reference: null,
        amount: 3000,
        currency: 'GHS',
        // A real Paystack refund status. 'success' is a TRANSACTION status.
        status: 'processed',
        transactionReference: 'DHV-REF1',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    } as never)
    mockListRefunds.mockResolvedValue({ success: true, refunds: [] } as never)
  })

  it('issues a Paystack refund in pesewas and marks the row PROCESSED', async () => {
    const result = await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'MANUAL',
      reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
      actor: ADMIN,
    })

    expect(result.refunds).toHaveLength(1)
    expect(result.refunds[0].status).toBe('PROCESSED')
    expect(result.refunds[0].paystackRefundId).toBe('9001')
    expect(result.orderRefunded).toBe(false)

    expect(mockCreateRefund).toHaveBeenCalledTimes(1)
    expect(mockCreateRefund).toHaveBeenCalledWith('DHV-REF1', 3000, expect.anything())
  })

  it('refuses an order paid partly or fully with wallet', async () => {
    prisma = buildPrisma(baseOrder({ walletAmountApplied: 25 }))
    vi.mocked(getPrisma).mockReturnValue(prisma as never)

    await expect(
      createRefund({
        orderId: 'order_1',
        items: [{ orderItemId: 'item_a', amount: 30 }],
        source: 'MANUAL',
        reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
        actor: ADMIN,
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'paid partly or fully with wallet; refund manually',
      code: 'WALLET_PAYMENT',
    })

    expect(mockCreateRefund).not.toHaveBeenCalled()
  })

  it('refuses a wallet-only payment with no Paystack reference', async () => {
    prisma = buildPrisma(
      baseOrder({ payment: { id: 'pay_1', amount: 100, status: 'PAID', paystackRef: null, reference: 'no-ref' } })
    )
    vi.mocked(getPrisma).mockReturnValue(prisma as never)

    await expect(
      createRefund({
        orderId: 'order_1',
        items: [{ orderItemId: 'item_a', amount: 30 }],
        source: 'MANUAL',
        reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
        actor: ADMIN,
      })
    ).rejects.toMatchObject({ status: 409, code: 'WALLET_ONLY_PAYMENT' })

    expect(mockCreateRefund).not.toHaveBeenCalled()
  })

  it('enforces the per-item pro-rated cap', async () => {
    await expect(
      createRefund({
        orderId: 'order_1',
        items: [{ orderItemId: 'item_a', amount: 31 }],
        source: 'MANUAL',
        reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
        actor: ADMIN,
      })
    ).rejects.toMatchObject({ status: 400, code: 'ITEM_CAP_EXCEEDED' })

    expect(mockCreateRefund).not.toHaveBeenCalled()
  })

  it('enforces the payment-level cap across items', async () => {
    await expect(
      createRefund({
        orderId: 'order_1',
        items: [
          { orderItemId: 'item_a', amount: 30 },
          { orderItemId: 'item_b', amount: 70 },
          { orderItemId: 'item_a', amount: 1 },
        ],
        source: 'MANUAL',
        reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
        actor: ADMIN,
      })
    ).rejects.toMatchObject({ status: 400, code: 'ITEM_CAP_EXCEEDED' })
  })

  it('rejects a manual refund whose key is not a UUID', async () => {
    await expect(
      createRefund({
        orderId: 'order_1',
        items: [{ orderItemId: 'item_a', amount: 30 }],
        source: 'MANUAL',
        reference: 'not-a-uuid',
        actor: ADMIN,
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST_ID' })
  })

  it('uses the deterministic key for automatic flows', async () => {
    await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'CUSTOMER_CANCEL',
      reference: 'item_a',
      reason: 'customer cancelled',
      actor: ADMIN,
    })

    const [created] = (prisma.__state.refunds as any[])
    expect(created.idempotencyKey).toBe('CUSTOMER_CANCEL:item_a')
  })

  it('never issues a second Paystack refund for the same manual requestId', async () => {
    const requestId = 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff'

    await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'MANUAL',
      reference: requestId,
      actor: ADMIN,
    })
    const second = await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'MANUAL',
      reference: requestId,
      actor: ADMIN,
    })

    expect(mockCreateRefund).toHaveBeenCalledTimes(1)
    expect(second.alreadyProcessed).toBe(true)
    expect(second.refunds[0].alreadyExisted).toBe(true)
  })

  it('marks the row FAILED when Paystack rejects the refund', async () => {
    mockCreateRefund.mockResolvedValue(definiteRejection('Amount exceeds remaining balance', 422))

    const result = await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'MANUAL',
      reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
      actor: ADMIN,
    })

    expect(result.refunds[0].status).toBe('FAILED')
    expect(result.refunds[0].failureReason).toBe('Amount exceeds remaining balance')
    expect(result.orderRefunded).toBe(false)
  })

  it('marks the order REFUNDED once the whole payment is refunded', async () => {
    const result = await createRefund({
      orderId: 'order_1',
      items: [
        { orderItemId: 'item_a', amount: 30 },
        { orderItemId: 'item_b', amount: 70 },
      ],
      source: 'MANUAL',
      reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
      actor: ADMIN,
    })

    expect(mockCreateRefund).toHaveBeenCalledTimes(2)
    expect(result.orderRefunded).toBe(true)

    const statuses = result.refunds.map((r) => r.status)
    expect(statuses).toEqual(['PROCESSED', 'PROCESSED'])
    // Every item was refunded, so the order settles to REFUNDED.
    const orderUpdates = (prisma.order.update as any).mock.calls.map((call: any[]) => call[0].data)
    expect(orderUpdates).toEqual(
      expect.arrayContaining([expect.objectContaining({ paymentStatus: 'REFUNDED' })])
    )
  })

  it('sends one refund confirmation email per Refund row that becomes PROCESSED', async () => {
    const result = await createRefund({
      orderId: 'order_1',
      items: [
        { orderItemId: 'item_a', amount: 30 },
        { orderItemId: 'item_b', amount: 70 },
      ],
      source: 'MANUAL',
      reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
      actor: ADMIN,
    })

    // One email per refund row, not one per order.
    expect(mockSendRefundEmail).toHaveBeenCalledTimes(2)
    expect(mockSendRefundEmail.mock.calls.map((call: any[]) => call[3])).toEqual([30, 70])
    expect(mockSendRefundEmail.mock.calls.every((call: any[]) => call[0] === 'customer@example.test')).toBe(true)
    // Both rows reached PROCESSED.
    expect(result.refunds.map((r) => r.status)).toEqual(['PROCESSED', 'PROCESSED'])
  })

  it('leaves the order PAID and still emails when only part of the payment is refunded', async () => {
    const result = await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'MANUAL',
      reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
      actor: ADMIN,
    })

    // The refund row is processed, so the customer is told - even though the
    // order is only partially refunded and stays PAID.
    expect(mockSendRefundEmail).toHaveBeenCalledTimes(1)
    expect(result.orderRefunded).toBe(false)
    const orderUpdates = (prisma.order.update as any).mock.calls.map((call: any[]) => call[0].data)
    expect(orderUpdates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ paymentStatus: 'REFUNDED' })])
    )
  })

  it('sends no email while the refund is still in flight', async () => {
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: {
        id: 9001,
        reference: null,
        amount: 3000,
        currency: 'GHS',
        status: 'processing',
        transactionReference: 'DHV-REF1',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    } as never)

    await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'MANUAL',
      reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
      actor: ADMIN,
    })

    expect(mockSendRefundEmail).not.toHaveBeenCalled()
  })

  it("records an unrecognised Paystack status without guessing and notifies the admins", async () => {
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: {
        id: 9001,
        reference: null,
        amount: 3000,
        currency: 'GHS',
        // Neither a documented refund status nor a transaction status we map.
        status: 'brand-new-paystack-status',
        transactionReference: 'DHV-REF1',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    } as never)

    const result = await createRefund({
      orderId: 'order_1',
      items: [{ orderItemId: 'item_a', amount: 30 }],
      source: 'MANUAL',
      reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
      actor: ADMIN,
    })

    // The row keeps a short code, stays PENDING, and attaches no Paystack id.
    const row = (prisma.__state.refunds as any[])[0]
    expect(row.status).toBe('PENDING')
    expect(row.paystackStatus).toBeNull()
    expect(row.paystackRefundId).toBeNull()
    expect(row.failureReason).toBe('UNKNOWN_PAYSTACK_STATUS')
    expect(result.refunds[0].status).toBe('PENDING')
    // The admins are told, with the raw status verbatim in the notification.
    const messages = vi.mocked(createNotification).mock.calls.map((call: any[]) => call[3])
    expect(messages.join('\n')).toContain('brand-new-paystack-status')
    // And nobody is emailed about a refund that has not been processed.
    expect(mockSendRefundEmail).not.toHaveBeenCalled()
  })
})

describe('createRefund Paystack failure handling', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    resetRefundEmailsForTest()
    prisma = buildPrisma(baseOrder())
    vi.mocked(getPrisma).mockReturnValue(prisma as never)
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: {
        id: 9001,
        reference: null,
        amount: 3000,
        currency: 'GHS',
        status: 'processed',
        transactionReference: 'DHV-REF1',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    } as never)
    mockListRefunds.mockResolvedValue({ success: true, refunds: [] } as never)
  })

  const ONE_ITEM = {
    orderId: 'order_1',
    items: [{ orderItemId: 'item_a', amount: 30 }],
    source: 'MANUAL' as const,
    reference: 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff',
    actor: ADMIN,
  }

  it('leaves the row PENDING on a timeout and keeps it counting against the caps', async () => {
    mockCreateRefund.mockResolvedValue({
      success: false,
      error: { code: 'TIMEOUT', message: 'Paystack refund request timed out' },
    } as never)

    await createRefund(ONE_ITEM)

    const row = (prisma.__state.refunds as any[])[0]
    // Not failed: the refund may well have gone through at Paystack.
    expect(row.status).toBe('PENDING')
    expect(row.paystackRefundId).toBeNull()
    expect(row.failureReason).toBe('PAYSTACK_TIMEOUT')
    // Only a code is stored - never a free-form message.
    expect(row.failureReason).not.toContain('timed out')

    // The pending row still consumes the item cap, so the same amount cannot
    // be requested a second time under a different requestId.
    await expect(
      createRefund({ ...ONE_ITEM, reference: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })
    ).rejects.toMatchObject({ code: 'ITEM_CAP_EXCEEDED' })
    expect(mockCreateRefund).toHaveBeenCalledTimes(1)
  })

  it('cannot issue a second Paystack refund for the same amount after a timeout', async () => {
    mockCreateRefund.mockResolvedValue({
      success: false,
      error: { code: 'TIMEOUT', message: 'Paystack refund request timed out' },
    } as never)

    // First attempt: inconclusive, so the row stays PENDING.
    const first = await createRefund(ONE_ITEM)
    expect(first.refunds[0].status).toBe('PENDING')
    expect(mockCreateRefund).toHaveBeenCalledTimes(1)

    // Replaying the same requestId replays the idempotency key, so the row is
    // reported as already processed and no second Paystack call is made.
    const again = await createRefund(ONE_ITEM)
    expect(again.alreadyProcessed).toBe(true)
    expect(again.refunds[0].alreadyExisted).toBe(true)
    expect(mockCreateRefund).toHaveBeenCalledTimes(1)

    // A different requestId hits the cap the pending row already consumed.
    await expect(
      createRefund({ ...ONE_ITEM, reference: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })
    ).rejects.toMatchObject({ code: 'ITEM_CAP_EXCEEDED' })
    expect(mockCreateRefund).toHaveBeenCalledTimes(1)
  })

  it('marks the row FAILED on a definite Paystack 422 and frees the caps', async () => {
    mockCreateRefund.mockResolvedValue(
      definiteRejection('Amount exceeds remaining balance', 422)
    )

    const result = await createRefund(ONE_ITEM)

    const row = (prisma.__state.refunds as any[])[0]
    expect(row.status).toBe('FAILED')
    expect(row.failureReason).toBe('Amount exceeds remaining balance')
    expect(result.refunds[0].status).toBe('FAILED')
    // The Paystack message is kept on a definitively rejected row.
    expect(result.refunds[0].failureReason).toBe('Amount exceeds remaining balance')

    // A FAILED row does not consume the cap, so the amount is refundable again.
    prisma = buildPrisma(baseOrder())
    vi.mocked(getPrisma).mockReturnValue(prisma as never)
    const after = await createRefund(ONE_ITEM)
    expect(after.alreadyProcessed).toBe(false)
    expect(mockCreateRefund).toHaveBeenCalledTimes(2)
  })

  it.each([400, 401, 403, 404])('marks the row FAILED on a definite Paystack %s', async (status) => {
    mockCreateRefund.mockResolvedValue(
      definiteRejection('Paystack rejected the refund', status)
    )

    const result = await createRefund(ONE_ITEM)

    expect(result.refunds[0].status).toBe('FAILED')
    const row = (prisma.__state.refunds as any[])[0]
    expect(row.status).toBe('FAILED')
    expect(row.failureReason).toBe('Paystack rejected the refund')
  })

  it.each([500, 502, 503])('leaves the row PENDING on HTTP %s', async (status) => {
    mockCreateRefund.mockResolvedValue(
      definiteRejection('Paystack had a server error', status)
    )

    await createRefund(ONE_ITEM)

    const row = (prisma.__state.refunds as any[])[0]
    expect(row.status).toBe('PENDING')
    expect(row.failureReason).toBe(`PAYSTACK_HTTP_${status}`)
    expect(row.paystackRefundId).toBeNull()
  })

  it('leaves the row PENDING on 429', async () => {
    mockCreateRefund.mockResolvedValue(
      definiteRejection('Too many requests', 429)
    )

    await createRefund(ONE_ITEM)

    expect((prisma.__state.refunds as any[])[0].failureReason).toBe('PAYSTACK_RATE_LIMITED')
  })

  it('leaves the row PENDING on a NETWORK_ERROR', async () => {
    mockCreateRefund.mockResolvedValue({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'fetch failed' },
    } as never)

    await createRefund(ONE_ITEM)

    expect((prisma.__state.refunds as any[])[0].failureReason).toBe('PAYSTACK_NETWORK_ERROR')
  })

  it('leaves the row PENDING when the response could not be parsed', async () => {
    // A 422 with our generic fallback message is not a definite rejection: we
    // never actually read a Paystack message.
    mockCreateRefund.mockResolvedValue({
      success: false,
      error: {
        code: 'API_ERROR',
        message: 'Paystack refund request failed (HTTP 422)',
        httpStatus: 422,
        messageSource: 'GENERIC',
      },
    } as never)

    await createRefund(ONE_ITEM)

    expect((prisma.__state.refunds as any[])[0].status).toBe('PENDING')
    expect((prisma.__state.refunds as any[])[0].failureReason).toBe('PAYSTACK_UNPARSEABLE_RESPONSE')
  })

  it('leaves the row PENDING when Paystack is not configured', async () => {
    mockCreateRefund.mockResolvedValue({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Paystack secret key is not configured' },
    } as never)

    await createRefund(ONE_ITEM)

    expect((prisma.__state.refunds as any[])[0].failureReason).toBe('PAYSTACK_NOT_CONFIGURED')
  })

  it('notifies the admins that an indeterminate refund needs checking', async () => {
    mockCreateRefund.mockResolvedValue({
      success: false,
      error: { code: 'TIMEOUT', message: 'Paystack refund request timed out' },
    } as never)

    await createRefund(ONE_ITEM)

    const messages = vi.mocked(createNotification).mock.calls.map((call: any[]) => call[3])
    expect(messages.join('\n')).toContain('PAYSTACK_TIMEOUT')
    expect(messages.join('\n')).toContain('not been marked failed')
  })
})

function makeRefundRow(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  return {
    id: 'refund_1',
    paymentId: 'pay_1',
    orderItemId: 'item_a',
    orderId: 'order_1',
    amount: 30,
    currency: 'GHS',
    status: 'PENDING',
    idempotencyKey: 'CUSTOMER_CANCEL:item_a',
    paystackRefundId: null,
    paystackStatus: null,
    failureReason: null,
    retryCount: 0,
    processedAt: null,
    createdAt: now,
    reason: null,
    // notifyRefundProcessed re-reads the row with its customer relation.
    order: { user: { email: 'customer@example.test', profile: { firstName: 'Ada' } } },
    payment: {
      id: 'pay_1',
      amount: 100,
      status: 'PAID',
      paystackRef: 'DHV-REF1',
      reference: 'DHV-REF1',
      orderId: 'order_1',
      order: { id: 'order_1', userId: 'user_1' },
    },
    orderItem: { productId: 'p1', quantity: 1, price: 30 },
    ...overrides,
  }
}

function paystackRefund(overrides: Record<string, unknown> = {}) {
  return {
    id: 9001,
    reference: null,
    amount: 3000,
    currency: 'GHS',
    // A real Paystack refund status.
    status: 'processed',
    transactionReference: 'DHV-REF1',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  }
}

describe('checkRefundStatus', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildPrisma(baseOrder())
    vi.mocked(getPrisma).mockReturnValue(prisma as never)
    mockListRefunds.mockResolvedValue({ success: true, refunds: [] } as never)
    mockCreateRefund.mockResolvedValue({
      success: true,
      refund: paystackRefund(),
    } as never)
  })

  it('reports a final row without calling Paystack', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({ status: 'PROCESSED', paystackRefundId: '9001' }) as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('ALREADY_FINAL')
    expect(mockListRefunds).not.toHaveBeenCalled()
  })

  it('attaches a unique Paystack match to a PENDING row with no Paystack id', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(makeRefundRow() as never)
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefund()] } as never)

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('ATTACHED')
    expect(result.paystackRefundId).toBe('9001')
    expect(result.status).toBe('PROCESSED')

    const [updateCall] = (prisma.refund.update as any).mock.calls
    expect(updateCall[0].data).toMatchObject({ paystackRefundId: '9001', status: 'PROCESSED' })
  })

  it('changes nothing and notifies the admins when the match is ambiguous', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(makeRefundRow() as never)
    mockListRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001 }), paystackRefund({ id: 9002 })],
    } as never)

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('AMBIGUOUS')
    expect(result.status).toBe('PENDING')
    expect(prisma.refund.update).not.toHaveBeenCalled()
    const notified = vi.mocked(prisma.user.findMany).mock.calls
    expect(notified.length).toBeGreaterThan(0)
  })

  it('does not match on amount alone (creation time must agree)', async () => {
    const stuck = makeRefundRow({ createdAt: new Date(Date.now() - 60 * 60 * 1000) })
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(stuck as never)
    mockListRefunds.mockResolvedValue({ success: true, refunds: [paystackRefund()] } as never)

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('NO_MATCH')
    expect(prisma.refund.update).not.toHaveBeenCalled()
  })

  it('reconciles a row that already knows its Paystack id', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({ paystackRefundId: '9001' }) as never
    )
    mockListRefunds.mockResolvedValue(
      { success: true, refunds: [paystackRefund({ status: 'processing' })] } as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('RECONCILED')
    expect(result.status).toBe('PROCESSING')
  })

  it('reports the eligibility window before the 10 minute grace period ends', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({ createdAt: new Date(Date.now() - 60 * 1000) }) as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('NO_MATCH')
    expect(result.eligibleForManualResolution).toBe(false)
    const eligibleAt = result.eligibleAt as Date
    expect(eligibleAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('refuses MARK_FAILED before the grace period and marks FAILED afterwards', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({ createdAt: new Date(Date.now() - 60 * 1000) }) as never
    )

    await expect(
      checkRefundStatus('refund_1', ADMIN, 'MARK_FAILED')
    ).rejects.toMatchObject({ status: 409, code: 'TOO_EARLY_FOR_MANUAL_RESOLUTION' })

    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({ createdAt: new Date(Date.now() - 15 * 60 * 1000) }) as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN, 'MARK_FAILED')

    expect(result.outcome).toBe('MARKED_FAILED')
    expect(result.status).toBe('FAILED')
    expect(mockCreateRefund).not.toHaveBeenCalled()

    const lastUpdate = (prisma.refund.update as any).mock.calls.at(-1)?.[0]
    expect(lastUpdate.data).toMatchObject({ status: 'FAILED' })
    expect(lastUpdate.where).toEqual({ id: 'refund_1' })
  })

  it('is idempotent: MARK_FAILED on an already settled row reports ALREADY_FINAL', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({
        status: 'FAILED',
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
        failureReason: 'already handled',
      }) as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN, 'MARK_FAILED')

    expect(result.outcome).toBe('ALREADY_FINAL')
    expect(prisma.refund.update).not.toHaveBeenCalled()
  })

  it('resubmits a stuck row under the same record and Payment lock', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({ createdAt: new Date(Date.now() - 15 * 60 * 1000) }) as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN, 'RESUBMIT')

    expect(result.outcome).toBe('RESUBMITTED')
    expect(result.paystackRefundId).toBe('9001')
    // Same row and payment, not a new row.
    expect(mockCreateRefund).toHaveBeenCalledWith('DHV-REF1', 3000, expect.anything())
    const lastUpdate = (prisma.refund.update as any).mock.calls.at(-1)?.[0]
    expect(lastUpdate.data).toMatchObject({ paystackRefundId: '9001' })
    expect(lastUpdate.where).toEqual({ id: 'refund_1' })
    // The Payment row was locked for the duration of the action.
    expect((prisma.$transaction as any).mock.calls.length).toBeGreaterThan(0)
  })

  it('refuses to resubmit a row that is already linked to a Paystack refund', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({
        status: 'NEEDS_ATTENTION',
        paystackRefundId: '9001',
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      }) as never
    )
    mockListRefunds.mockResolvedValue({ success: true, refunds: [] } as never)

    const result = await checkRefundStatus('refund_1', ADMIN, 'RESUBMIT')

    expect(result.outcome).toBe('ALREADY_FINAL')
    expect(mockCreateRefund).not.toHaveBeenCalled()
  })

  it('surfaces Paystack failures instead of marking the refund failed', async () => {
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(
      makeRefundRow({ createdAt: new Date(Date.now() - 15 * 60 * 1000) }) as never
    )
    mockListRefunds.mockResolvedValue({
      success: false,
      refunds: [],
      error: { code: 'API_ERROR', message: 'boom', httpStatus: 500 },
    } as never)

    await expect(checkRefundStatus('refund_1', ADMIN)).rejects.toMatchObject({
      status: 502,
      code: 'PAYSTACK_UNREACHABLE',
    })
    expect(prisma.refund.update).not.toHaveBeenCalled()
  })

  it("moves PROCESSING to PROCESSED on 'processed' and emails the customer", async () => {
    const row = makeRefundRow({ status: 'PROCESSING', paystackRefundId: '9001', amount: 30 })
    prisma.__state.refunds.push(row)
    mockListRefunds.mockResolvedValue(
      { success: true, refunds: [paystackRefund({ status: 'processed' })] } as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('RECONCILED')
    expect(result.status).toBe('PROCESSED')
    expect(mockSendRefundEmail).toHaveBeenCalledTimes(1)
  })

  it('settles the order only when the PROCESSED refunds cover the full payment', async () => {
    const row = makeRefundRow({ status: 'PROCESSING', paystackRefundId: '9001', amount: 100 })
    prisma.__state.refunds.push(row)
    mockListRefunds.mockResolvedValue(
      { success: true, refunds: [paystackRefund({ amount: 10_000, status: 'processed' })] } as never
    )

    await checkRefundStatus('refund_1', ADMIN)

    const orderUpdates = (prisma.order.update as any).mock.calls.map((call: any[]) => call[0].data)
    expect(orderUpdates).toEqual(
      expect.arrayContaining([expect.objectContaining({ paymentStatus: 'REFUNDED' })])
    )
  })

  it('leaves the order PAID when the PROCESSED refunds cover only part of the payment', async () => {
    const row = makeRefundRow({ status: 'PROCESSING', paystackRefundId: '9001', amount: 30 })
    prisma.__state.refunds.push(row)
    mockListRefunds.mockResolvedValue(
      { success: true, refunds: [paystackRefund({ status: 'processed' })] } as never
    )

    await checkRefundStatus('refund_1', ADMIN)

    expect(prisma.order.update).not.toHaveBeenCalled()
    // The customer is still told about the refund that did complete.
    expect(mockSendRefundEmail).toHaveBeenCalledTimes(1)
  })

  it('changes nothing and reports UNKNOWN_STATUS for an unrecognised Paystack status', async () => {
    const row = makeRefundRow({ status: 'PROCESSING', paystackRefundId: '9001', amount: 30 })
    prisma.__state.refunds.push(row)
    mockListRefunds.mockResolvedValue(
      { success: true, refunds: [paystackRefund({ status: 'brand-new-paystack-status' })] } as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('UNKNOWN_STATUS')
    // Nothing was guessed and nothing was changed.
    expect(result.status).toBe('PROCESSING')
    expect(prisma.refund.update).not.toHaveBeenCalled()
    // The raw status goes to the admins only; the row keeps a code-only note.
    expect(result.paystackStatus).toBeNull()
    expect(result.message).toContain('brand-new-paystack-status')
    const messages = vi.mocked(createNotification).mock.calls.map((call: any[]) => call[3])
    expect(messages.join('\n')).toContain('brand-new-paystack-status')
    expect(mockSendRefundEmail).not.toHaveBeenCalled()
  })

  it("reports UNKNOWN_STATUS rather than guessing when Paystack says 'success'", async () => {
    const row = makeRefundRow({ status: 'PROCESSING', paystackRefundId: '9001', amount: 30 })
    prisma.__state.refunds.push(row)
    mockListRefunds.mockResolvedValue(
      { success: true, refunds: [paystackRefund({ status: 'success' })] } as never
    )

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('UNKNOWN_STATUS')
    expect(result.status).toBe('PROCESSING')
    // No Paystack id is attached, so reconciliation can match it again later.
    expect(result.paystackRefundId).toBeNull()
    const messages = vi.mocked(createNotification).mock.calls.map((call: any[]) => call[3])
    expect(messages.join('\n')).toContain('success')
  })

  it('leaves the row PENDING and reports INDETERMINATE when a resubmit times out', async () => {
    const row = makeRefundRow({
      status: 'PENDING',
      paystackRefundId: null,
      amount: 30,
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    })
    prisma.__state.refunds.push(row)
    mockListRefunds.mockResolvedValue({ success: true, refunds: [] } as never)
    mockCreateRefund.mockResolvedValue({
      success: false,
      error: { code: 'TIMEOUT', message: 'Paystack refund request timed out' },
    } as never)

    const result = await checkRefundStatus('refund_1', ADMIN, 'RESUBMIT')

    expect(result.outcome).toBe('INDETERMINATE')
    // The row stays PENDING with no Paystack id and a code-only note.
    expect(row.status).toBe('PENDING')
    expect(row.paystackRefundId).toBeNull()
    expect(row.failureReason).toBe('PAYSTACK_TIMEOUT')
    expect(result.paystackRefundId).toBeNull()
    // Admins are told it needs checking, not that it failed.
    const messages = vi.mocked(createNotification).mock.calls.map((call: any[]) => call[3])
    expect(messages.join('\n')).toContain('PAYSTACK_TIMEOUT')
    expect(mockSendRefundEmail).not.toHaveBeenCalled()
  })

  it('marks the row FAILED when a resubmit is definitively rejected', async () => {
    const row = makeRefundRow({
      status: 'PENDING',
      paystackRefundId: null,
      amount: 30,
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    })
    prisma.__state.refunds.push(row)
    mockListRefunds.mockResolvedValue({ success: true, refunds: [] } as never)
    mockCreateRefund.mockResolvedValue(definiteRejection('Amount exceeds remaining balance', 422))

    const result = await checkRefundStatus('refund_1', ADMIN, 'RESUBMIT')

    expect(result.outcome).toBe('MARKED_FAILED')
    expect(result.status).toBe('FAILED')
    expect(row.status).toBe('FAILED')
    expect(row.failureReason).toBe('Amount exceeds remaining balance')
  })

  it('attaches the refund found via listPaystackRefunds to a PENDING row left by a timeout', async () => {
    // createRefund left this row PENDING with no Paystack id after a timeout.
    const row = makeRefundRow({
      status: 'PENDING',
      paystackRefundId: null,
      amount: 30,
      failureReason: 'PAYSTACK_TIMEOUT',
      createdAt: new Date(),
    })
    prisma.__state.refunds.push(row)
    // Reconciliation finds the refund Paystack actually created.
    mockListRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000, status: 'processed' })],
    } as never)

    const result = await checkRefundStatus('refund_1', ADMIN)

    expect(result.outcome).toBe('ATTACHED')
    expect(result.paystackRefundId).toBe('9001')
    expect(row.paystackRefundId).toBe('9001')
    expect(row.status).toBe('PROCESSED')
    expect(row.failureReason).toBeNull()
    // The customer is told now that the refund is confirmed.
    expect(mockSendRefundEmail).toHaveBeenCalledTimes(1)
  })
})
