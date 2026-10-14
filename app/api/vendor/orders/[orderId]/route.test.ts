import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Characterization tests for PATCH /api/vendor/orders/[orderId].
// These pin the CURRENT behaviour before the integrity fix, with emphasis on
// the reject (vendor cancellation) action. All data below is obviously fake.

const prismaMock = vi.hoisted(() => ({
  store: {
    findUnique: vi.fn(),
  },
  order: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
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

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({
  isVendorOnboarded: isVendorOnboardedMock,
}))

const sendOrderStatusUpdateEmailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/lib/email', () => ({
  sendOrderStatusUpdateEmail: sendOrderStatusUpdateEmailMock,
}))

const canSendCustomerEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))
vi.mock('@/lib/notification-preferences', () => ({
  canSendCustomerEmail: canSendCustomerEmailMock,
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

const consumeInventoryMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, consumedItems: [] })
)
const releaseStockMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, releasedItems: [] })
)
vi.mock('@/lib/stock-reservation', () => ({
  consumeInventory: consumeInventoryMock,
  releaseStock: releaseStockMock,
}))

const createNotificationMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/lib/notifications', () => ({
  createNotification: createNotificationMock,
}))

const creditInfluencerOrderCashbackMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
const reverseInfluencerOrderCashbackMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/lib/influencer/order-cashback', () => ({
  creditInfluencerOrderCashback: creditInfluencerOrderCashbackMock,
  reverseInfluencerOrderCashback: reverseInfluencerOrderCashbackMock,
}))

const notifySuperAdminsRefundRequestedMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/lib/refunds/admin-notify', () => ({
  notifySuperAdminsRefundRequested: notifySuperAdminsRefundRequestedMock,
}))

import { PATCH } from '@/app/api/vendor/orders/[orderId]/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

function buildRequest(body: unknown, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/orders/order_1', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
    body: JSON.stringify(body),
  })
}

const PARAMS = { params: { orderId: 'order_1' } }

function mockVendorStore() {
  prismaMock.store.findUnique.mockResolvedValue({
    id: 'store_1',
    userId: 'vendor_1',
    name: 'Fake Store',
    products: [{ id: 'prod_1' }],
  })
}

function mockExistingOrder(overrides: Record<string, unknown> = {}) {
  const order = {
    id: 'order_1',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'PROCESSING',
    orderType: 'NORMAL',
    total: 100,
    walletAmountApplied: 0,
    vendorAccepted: false,
    vendorRejected: false,
    vendorRejectionReason: null,
    ...overrides,
  }
  prismaMock.order.findFirst.mockResolvedValue(order)
  return order
}

function mockOrderWithUser() {
  prismaMock.order.findUnique.mockResolvedValue({
    id: 'order_1',
    userId: 'buyer_1',
    user: {
      email: 'buyer@example.invalid',
      profile: { firstName: 'Fake', lastName: 'Buyer' },
    },
  })
}

describe('PATCH /api/vendor/orders/[orderId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockResolvedValue(VENDOR)
    isVendorOnboardedMock.mockResolvedValue(true)
    mockVendorStore()
    mockOrderWithUser()
    prismaMock.order.update.mockResolvedValue({
      id: 'order_1',
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
      vendorAccepted: false,
      vendorRejected: true,
      vendorRejectionReason: 'out of stock',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })
  })

  it('returns 401 when no token cookie is present', async () => {
    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'x' }, false),
      PARAMS
    )

    expect(response.status).toBe(401)
  })

  it('returns 403 when the vendor has not completed onboarding', async () => {
    isVendorOnboardedMock.mockResolvedValue(false)

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'x' }),
      PARAMS
    )

    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    prismaMock.store.findUnique.mockResolvedValue(null)

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'x' }),
      PARAMS
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 when the order is not the vendor’s paid order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'x' }),
      PARAMS
    )

    expect(response.status).toBe(404)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('rejects an invalid acceptance action', async () => {
    mockExistingOrder()

    const response = await PATCH(buildRequest({ action: 'refund' }), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid action')
  })

  it('accepts an order', async () => {
    mockExistingOrder()
    prismaMock.order.update.mockResolvedValue({
      id: 'order_1',
      status: 'PROCESSING',
      fulfillmentStatus: 'PROCESSING',
      vendorAccepted: true,
      vendorRejected: false,
      vendorRejectionReason: null,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const response = await PATCH(buildRequest({ action: 'accept' }), PARAMS)

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: {
        vendorAccepted: true,
        vendorRejected: false,
        vendorRejectionReason: null,
      },
    })
  })

  it('requires a rejection reason', async () => {
    mockExistingOrder()

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: '   ' }),
      PARAMS
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Rejection reason is required')
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('refuses to reject an already rejected order (one-shot)', async () => {
    mockExistingOrder({ vendorRejected: true, vendorRejectionReason: 'out of stock' })

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'again' }),
      PARAMS
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Order already rejected')
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('cancels a PAID NORMAL order, keeps it PAID and records a pending refund request', async () => {
    // CHANGED in the fix commit: previously this wrote paymentStatus
    // 'REFUNDED' straight to the order (database-only, no Paystack call, no
    // Refund row). The order now stays PAID and the refund is recorded as a
    // request for admin approval.
    mockExistingOrder()

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: {
        vendorAccepted: false,
        vendorRejected: true,
        vendorRejectionReason: 'out of stock',
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
      },
    })
    expect(releaseStockMock).toHaveBeenCalledWith('order_1', 'vendor_1', ['prod_1'])
    expect(reverseInfluencerOrderCashbackMock).toHaveBeenCalledWith('order_1')
  })

  it('records the cancellation itself with an audit log and fulfillment event', async () => {
    // CHANGED in the fix commit: the reject previously wrote neither.
    mockExistingOrder()

    await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(recordFulfillmentEventMock).toHaveBeenCalledWith(
      'order_1',
      'CANCELLED',
      'vendor_1',
      { description: 'out of stock' }
    )
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'vendor_1',
        userRole: 'VENDOR',
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: 'order_1',
        afterData: expect.objectContaining({
          status: 'CANCELLED',
          vendorRejected: true,
          vendorRejectionReason: 'out of stock',
        }),
      })
    )
  })

  it('records a VENDOR_REJECTION refund request for a paid rejection', async () => {
    // CHANGED in the fix commit: replaces the false paymentStatus REFUNDED.
    mockExistingOrder()

    await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(recordFulfillmentEventMock).toHaveBeenCalledWith(
      'order_1',
      'REFUND_REQUESTED',
      'vendor_1'
    )
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_REFUND_REQUESTED',
        entityType: 'ORDER',
        entityId: 'order_1',
        afterData: expect.objectContaining({
          source: 'VENDOR_REJECTION',
          total: 100,
          walletAssisted: false,
        }),
      })
    )
  })

  it('flags wallet-assisted orders in the rejection refund request metadata', async () => {
    // CHANGED in the Stage 1.5 commit: the audit metadata now carries the
    // wallet flag so admins know manual handling is required.
    mockExistingOrder({ walletAmountApplied: 25 })

    await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_REFUND_REQUESTED',
        afterData: expect.objectContaining({
          source: 'VENDOR_REJECTION',
          walletAssisted: true,
        }),
      })
    )
  })

  it('notifies the super admins that a refund request is waiting', async () => {
    await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(notifySuperAdminsRefundRequestedMock).toHaveBeenCalledTimes(1)
    expect(notifySuperAdminsRefundRequestedMock).toHaveBeenCalledWith({
      orderId: 'order_1',
      total: 100,
      storeName: 'Fake Store',
      source: 'VENDOR_REJECTION',
    })
  })

  it('does not notify super admins when the rejected order was not paid', async () => {
    mockExistingOrder({ status: 'PENDING', paymentStatus: 'PENDING' })
    prismaMock.order.update.mockResolvedValue({
      id: 'order_1',
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
      vendorAccepted: false,
      vendorRejected: true,
      vendorRejectionReason: 'out of stock',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(notifySuperAdminsRefundRequestedMock).not.toHaveBeenCalled()
  })

  it('still rejects when the super admin notification fails', async () => {
    notifySuperAdminsRefundRequestedMock.mockRejectedValueOnce(new Error('mail down'))

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.order.vendorRejected).toBe(true)
    expect(body.order.status).toBe('CANCELLED')
  })

  it('rejects an unpaid order without touching paymentStatus', async () => {
    mockExistingOrder({ status: 'PENDING', paymentStatus: 'PENDING', fulfillmentStatus: 'PENDING' })
    prismaMock.order.update.mockResolvedValue({
      id: 'order_1',
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
      vendorAccepted: false,
      vendorRejected: true,
      vendorRejectionReason: 'out of stock',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: {
        vendorAccepted: false,
        vendorRejected: true,
        vendorRejectionReason: 'out of stock',
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
      },
    })
  })

  it('notifies the customer and sends an email on rejection', async () => {
    mockExistingOrder()

    await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(createNotificationMock).toHaveBeenCalledWith(
      'buyer_1',
      'ORDER_STATUS_UPDATED',
      'Order Rejected by Vendor',
      // CHANGED in the fix commit: the paid-order tail no longer claims a
      // refund "is being processed"; it says the request is pending review.
      expect.stringContaining('A refund has been requested and is pending review.')
    )
    expect(canSendCustomerEmailMock).toHaveBeenCalledWith('buyer_1')
    expect(sendOrderStatusUpdateEmailMock).toHaveBeenCalledWith(
      'buyer@example.invalid',
      'Fake',
      'order_1',
      'CANCELLED'
    )
  })

  it('does not release stock for a rejected non-NORMAL order', async () => {
    mockExistingOrder({ orderType: 'PREORDER' })

    await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'delayed' }),
      PARAMS
    )

    expect(releaseStockMock).not.toHaveBeenCalled()
  })

  it('returns 500 when stock release fails on rejection', async () => {
    mockExistingOrder()
    releaseStockMock.mockResolvedValue({ success: false, error: 'db down' })

    const response = await PATCH(
      buildRequest({ action: 'reject', rejectionReason: 'out of stock' }),
      PARAMS
    )

    expect(response.status).toBe(500)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('refuses CANCELLED as a direct vendor status update', async () => {
    mockExistingOrder()

    const response = await PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid status')
  })

  it('enforces forward-only status transitions', async () => {
    mockExistingOrder({ status: 'PENDING' })

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Cannot move from PENDING to SHIPPED')
  })

  it('allows a valid forward status transition', async () => {
    mockExistingOrder({ status: 'PENDING', fulfillmentStatus: 'PENDING' })
    prismaMock.order.update.mockResolvedValue({
      id: 'order_1',
      status: 'PROCESSING',
      fulfillmentStatus: 'PROCESSING',
      vendorAccepted: false,
      vendorRejected: false,
      vendorRejectionReason: null,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const response = await PATCH(buildRequest({ status: 'PROCESSING' }), PARAMS)

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'PROCESSING' },
    })
  })

  it('returns 403 when the token is not authenticated', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: false, reason: 'invalid_token' })

    const response = await PATCH(buildRequest({ action: 'accept' }), PARAMS)

    expect(response.status).toBe(403)
  })
})
