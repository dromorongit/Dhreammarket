import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Tests for PATCH /api/orders/[orderId]/cancel.
//
// Started as characterization tests pinning the pre-fix behaviour; the tests
// that pinned behaviour this task intentionally changed were updated in the
// fix commit (app/api/orders/[orderId]/cancel/route.ts) and carry a comment
// explaining why. All data below is obviously fake.

const prismaMock = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: verifyTokenMock,
}))

const recordFulfillmentEventMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(null)
)
vi.mock('@/lib/fulfillment-events', () => ({
  recordFulfillmentEvent: recordFulfillmentEventMock,
}))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: createAuditLogMock,
}))

const releaseStockMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, releasedItems: [] })
)
vi.mock('@/lib/stock-reservation', () => ({
  releaseStock: releaseStockMock,
}))

const createNotificationMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/lib/notifications', () => ({
  createNotification: createNotificationMock,
}))

const notifySuperAdminsRefundRequestedMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/lib/refunds/admin-notify', () => ({
  notifySuperAdminsRefundRequested: notifySuperAdminsRefundRequestedMock,
}))

const reverseInfluencerOrderCashbackMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/lib/influencer/order-cashback', () => ({
  reverseInfluencerOrderCashback: reverseInfluencerOrderCashbackMock,
}))

import { PATCH } from '@/app/api/orders/[orderId]/cancel/route'

const BUYER = {
  authenticated: true,
  userId: 'buyer_1',
  role: 'CUSTOMER',
  sessionId: 'sess_1',
}

function buildRequest(body: unknown, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/orders/order_1/cancel', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
    body: JSON.stringify(body),
  })
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    userId: 'buyer_1',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'PROCESSING',
    orderType: 'NORMAL',
    total: 100,
    walletAmountApplied: 0,
    items: [
      {
        product: {
          id: 'prod_1',
          name: 'Fake Product',
          store: { userId: 'vendor_1', name: 'Fake Store' },
        },
      },
    ],
    payment: { id: 'pay_1', status: 'PAID' },
    ...overrides,
  }
}

const PARAMS = { params: { orderId: 'order_1' } }

// The base where clause of the atomic conditional update for a NORMAL order.
const NORMAL_WHERE = {
  id: 'order_1',
  userId: 'buyer_1',
  deletedAt: null,
  status: { in: ['PENDING', 'PROCESSING'] },
}

describe('PATCH /api/orders/[orderId]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockResolvedValue(BUYER)
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
    // clearAllMocks also clears implementations, so the default resolution is
    // re-established here.
    notifySuperAdminsRefundRequestedMock.mockResolvedValue(undefined)
  })

  it('returns 401 when no token cookie is present', async () => {
    const response = await PATCH(buildRequest({ reason: 'x' }, false), PARAMS)

    expect(response.status).toBe(401)
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
  })

  it('returns 401 when the token is not authenticated', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: false, reason: 'invalid_token' })

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(401)
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not a customer', async () => {
    verifyTokenMock.mockResolvedValue({ ...BUYER, role: 'VENDOR', userId: 'vendor_1' })

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(403)
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not belong to the caller', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Order not found or access denied')
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
  })

  it('scopes the order lookup to the authenticated buyer', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order_1',
          userId: 'buyer_1',
          deletedAt: null,
        }),
      })
    )
  })

  it('refuses to cancel a SHIPPED order with the status message', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder({ status: 'SHIPPED' }))

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe(
      'Cannot cancel order with status: SHIPPED. Only orders pending or processing can be cancelled.'
    )
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to cancel a DELIVERED order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder({ status: 'DELIVERED' }))

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to cancel an already CANCELLED order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder({ status: 'CANCELLED' }))

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
  })

  it('refuses a non-NORMAL order at a late fulfillment stage', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ orderType: 'PREORDER', fulfillmentStatus: 'SHIPPED' })
    )

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('This order cannot be cancelled at its current fulfillment stage.')
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
  })

  it('allows a non-NORMAL order that is still awaiting stock', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ status: 'PENDING', orderType: 'BACKORDER', fulfillmentStatus: 'AWAITING_RESTOCK' })
    )

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        ...NORMAL_WHERE,
        id: 'order_1',
        fulfillmentStatus: {
          in: ['PENDING', 'PROCESSING', 'AWAITING_STOCK', 'AWAITING_RESTOCK'],
        },
      },
      data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' },
    })
  })

  it('allows a NORMAL order even at a late fulfillment stage (current bypass)', async () => {
    // Current behaviour: the fulfillment-stage guard is skipped entirely for
    // NORMAL orders. Pinned here; not changed by this task (report-only).
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ orderType: 'NORMAL', fulfillmentStatus: 'SHIPPED' })
    )

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: NORMAL_WHERE,
      data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' },
    })
  })

  it('cancels an unpaid order without recording any refund request', async () => {
    // CHANGED in the Stage 1.5 commit: requestRefund no longer controls
    // anything, so even with the flag set an unpaid order records no request.
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ status: 'PENDING', paymentStatus: 'PENDING' })
    )

    const response = await PATCH(
      buildRequest({ reason: 'x', requestRefund: true }),
      PARAMS
    )

    expect(response.status).toBe(200)
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { ...NORMAL_WHERE, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' },
    })
    const body = await response.json()
    expect(body.refundRequested).toBe(false)
    expect(recordFulfillmentEventMock).not.toHaveBeenCalledWith(
      'order_1',
      'REFUND_REQUESTED',
      'buyer_1'
    )
    expect(createAuditLogMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_REFUND_REQUESTED' })
    )
  })

  it('records a pending refund request for every paid cancellation, flag or not', async () => {
    // CHANGED in the Stage 1.5 commit: previously the request was only
    // recorded when requestRefund was true. It is now automatic for every
    // paid order; the body flag is accepted but ignored.
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(recordFulfillmentEventMock).toHaveBeenCalledWith(
      'order_1',
      'REFUND_REQUESTED',
      'buyer_1'
    )
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_REFUND_REQUESTED',
        entityType: 'ORDER',
        entityId: 'order_1',
        afterData: expect.objectContaining({
          source: 'CUSTOMER_CANCEL',
          total: 100,
          walletAssisted: false,
        }),
      })
    )
    const body = await response.json()
    expect(body.refundRequested).toBe(true)
    expect(body.order.paymentStatus).toBe('PAID')
  })

  it('notifies the super admins that a refund request is waiting', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(notifySuperAdminsRefundRequestedMock).toHaveBeenCalledTimes(1)
    expect(notifySuperAdminsRefundRequestedMock).toHaveBeenCalledWith({
      orderId: 'order_1',
      total: 100,
      storeName: 'Fake Store',
      source: 'CUSTOMER_CANCEL',
    })
  })

  it('names no store when the cancelled order spans several stores', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({
        items: [
          { product: { store: { userId: 'vendor_1', name: 'Store One' } } },
          { product: { store: { userId: 'vendor_2', name: 'Store Two' } } },
        ],
      })
    )

    await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(notifySuperAdminsRefundRequestedMock).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: null, source: 'CUSTOMER_CANCEL' })
    )
  })

  it('does not notify super admins when nothing was charged', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ status: 'PENDING', paymentStatus: 'PENDING' })
    )
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 })

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(notifySuperAdminsRefundRequestedMock).not.toHaveBeenCalled()
  })

  it('still cancels when the super admin notification fails', async () => {
    notifySuperAdminsRefundRequestedMock.mockRejectedValueOnce(new Error('mail down'))
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.order.status).toBe('CANCELLED')
  })

  it('flags wallet-assisted orders in the refund request metadata', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ walletAmountApplied: 25 })
    )

    await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_REFUND_REQUESTED',
        afterData: expect.objectContaining({
          source: 'CUSTOMER_CANCEL',
          walletAssisted: true,
        }),
      })
    )
  })

  it('records exactly one refund request when the buyer double submits', async () => {
    // The atomic conditional update from the integrity branch makes the
    // second submit fail, so the request is recorded exactly once.
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())
    prismaMock.order.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    prismaMock.order.findFirst
      .mockResolvedValueOnce(buildOrder())
      .mockResolvedValueOnce(buildOrder())
      .mockResolvedValueOnce({ id: 'order_1', status: 'CANCELLED' })

    const first = await PATCH(buildRequest({ reason: 'x' }), PARAMS)
    const second = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(first.status).toBe(200)
    expect(second.status).toBe(400)
    expect(
      createAuditLogMock.mock.calls.filter(
        call => (call[0] as { action?: string }).action === 'ORDER_REFUND_REQUESTED'
      )
    ).toHaveLength(1)
    expect(
      recordFulfillmentEventMock.mock.calls.filter(
        call => call[1] === 'REFUND_REQUESTED'
      )
    ).toHaveLength(1)
  })

  it('treats a lost race as not cancellable and runs no side effects', async () => {
    // CHANGED in the fix commit: the conditional updateMany replaced the
    // check-then-update, so a second rapid cancel loses the race.
    prismaMock.order.findFirst
      .mockResolvedValueOnce(buildOrder())
      .mockResolvedValueOnce({ id: 'order_1', status: 'CANCELLED' })
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 })

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe(
      'Cannot cancel order with status: CANCELLED. Only orders pending or processing can be cancelled.'
    )
    expect(reverseInfluencerOrderCashbackMock).not.toHaveBeenCalled()
    expect(recordFulfillmentEventMock).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
    expect(releaseStockMock).not.toHaveBeenCalled()
    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it('keeps the cancellation and flags it when stock release fails', async () => {
    // CHANGED in the fix commit: releaseStock is now awaited and its failure
    // is recorded in the audit log instead of being a silent fire-and-forget.
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())
    releaseStockMock.mockResolvedValue({ success: false, error: 'db down' })

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(releaseStockMock).toHaveBeenCalledWith('order_1', 'buyer_1')
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_CANCELLED',
        afterData: expect.objectContaining({ stockReleaseFailed: true }),
      })
    )
  })

  it('records the cancellation side effects', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    await PATCH(buildRequest({ reason: 'changed my mind' }), PARAMS)

    expect(reverseInfluencerOrderCashbackMock).toHaveBeenCalledWith('order_1')
    expect(recordFulfillmentEventMock).toHaveBeenCalledWith(
      'order_1',
      'CANCELLED',
      'buyer_1',
      { description: 'changed my mind' }
    )
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer_1',
        userRole: 'CUSTOMER',
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: 'order_1',
      })
    )
    expect(releaseStockMock).toHaveBeenCalledWith('order_1', 'buyer_1')
    expect(createNotificationMock).toHaveBeenCalledWith(
      'vendor_1',
      'ORDER_STATUS_UPDATED',
      'Order Cancelled by Customer',
      expect.stringContaining('cancelled')
    )
  })

  it('does not release stock for non-NORMAL orders', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ status: 'PENDING', orderType: 'PREORDER', fulfillmentStatus: 'AWAITING_STOCK' })
    )

    await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(releaseStockMock).not.toHaveBeenCalled()
  })

  it('returns the documented response shape', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    const response = await PATCH(
      buildRequest({ reason: 'x', requestRefund: true }),
      PARAMS
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      success: true,
      order: {
        id: 'order_1',
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
        paymentStatus: 'PAID',
        vendorRejected: true,
      },
      refundRequested: true,
    })
  })
})
