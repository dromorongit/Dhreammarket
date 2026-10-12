import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Characterization tests for PATCH /api/orders/[orderId]/cancel.
// These pin the CURRENT behaviour before the integrity fix, so the fix commit
// can show exactly what changed. All data below is obviously fake.

const prismaMock = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
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

// The current route re-reads the order with vendor store owners after the
// update, so every order.update assertion must include this include clause.
const UPDATE_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          store: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  },
}

describe('PATCH /api/orders/[orderId]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockResolvedValue(BUYER)
    prismaMock.order.update.mockResolvedValue({
      id: 'order_1',
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
      paymentStatus: 'PAID',
      items: [{ product: { store: { userId: 'vendor_1' } } }],
    })
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
    expect(prismaMock.order.update).not.toHaveBeenCalled()
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
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('refuses to cancel a DELIVERED order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder({ status: 'DELIVERED' }))

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('refuses to cancel an already CANCELLED order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder({ status: 'CANCELLED' }))

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('refuses a non-NORMAL order at a late fulfillment stage', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ orderType: 'PREORDER', fulfillmentStatus: 'SHIPPED' })
    )

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('This order cannot be cancelled at its current fulfillment stage.')
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('allows a non-NORMAL order that is still awaiting stock', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ status: 'PENDING', orderType: 'BACKORDER', fulfillmentStatus: 'AWAITING_RESTOCK' })
    )

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalled()
  })

  it('allows a NORMAL order even at a late fulfillment stage (current bypass)', async () => {
    // Current behaviour: the fulfillment-stage guard is skipped entirely for
    // NORMAL orders (cancel route lines 81-88). Pinned here; not changed by
    // this task (report-only).
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ orderType: 'NORMAL', fulfillmentStatus: 'SHIPPED' })
    )

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalled()
  })

  it('cancels an unpaid order without touching paymentStatus', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      buildOrder({ status: 'PENDING', paymentStatus: 'PENDING' })
    )
    prismaMock.order.update.mockResolvedValue({
      id: 'order_1',
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
      paymentStatus: 'PENDING',
      items: [{ product: { store: { userId: 'vendor_1' } } }],
    })

    const response = await PATCH(
      buildRequest({ reason: 'x', requestRefund: true }),
      PARAMS
    )

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' },
      include: UPDATE_INCLUDE,
    })
    const body = await response.json()
    expect(body.refundRequested).toBe(false)
  })

  it('marks paymentStatus REFUNDED when a paid order is cancelled with requestRefund (current behaviour)', async () => {
    // PINNED CURRENT BEHAVIOUR - updated in the fix commit: this is the false
    // REFUNDED flag (database-only, no Paystack call, no Refund row).
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    const response = await PATCH(
      buildRequest({ reason: 'x', requestRefund: true }),
      PARAMS
    )

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: {
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
        paymentStatus: 'REFUNDED',
      },
      include: UPDATE_INCLUDE,
    })
    const body = await response.json()
    expect(body.refundRequested).toBe(true)
  })

  it('does not mark paymentStatus REFUNDED when requestRefund is not set', async () => {
    prismaMock.order.findFirst.mockResolvedValue(buildOrder())

    const response = await PATCH(buildRequest({ reason: 'x' }), PARAMS)

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' },
      include: UPDATE_INCLUDE,
    })
    const body = await response.json()
    // Current behaviour: shouldProcessRefund is `undefined && ...` when the
    // field is absent, so the key is dropped from the JSON entirely.
    expect(body.refundRequested).toBeUndefined()
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
