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
  orderItem: {
    count: vi.fn(),
    findMany: vi.fn(),
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

// Mock the stampOrderItems function
const stampOrderItemsMock = vi.hoisted(() => vi.fn().mockResolvedValue(1))
vi.mock('@/lib/order-delivery-stamps', () => ({
  stampOrderItems: stampOrderItemsMock,
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
      id: 'buyer_1',
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
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'CANCELLED',
            fulfillmentStatus: 'CANCELLED',
            vendorAccepted: false,
            vendorRejected: true,
            vendorRejectionReason: 'out of stock',
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }
      return cb(tx)
    })
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
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'PROCESSING',
            fulfillmentStatus: 'PROCESSING',
            vendorAccepted: true,
            vendorRejected: false,
            vendorRejectionReason: null,
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: {
        email: 'buyer@example.invalid',
        profile: { firstName: 'Fake', lastName: 'Buyer' },
      },
    })

    const response = await PATCH(buildRequest({ action: 'accept' }), PARAMS)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.order.vendorAccepted).toBe(true)
    expect(body.order.vendorRejected).toBe(false)
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
    let transactionCalled = false
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      transactionCalled = true
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'PROCESSING',
            fulfillmentStatus: 'PROCESSING',
            vendorAccepted: false,
            vendorRejected: false,
            vendorRejectionReason: null,
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: {
        email: 'buyer@example.invalid',
        profile: { firstName: 'Fake', lastName: 'Buyer' },
      },
    })

    const response = await PATCH(buildRequest({ status: 'PROCESSING' }), PARAMS)

    console.log('transactionCalled:', transactionCalled)
    console.log('response.status:', response.status)

    expect(response.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('returns 403 when the token is not authenticated', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: false, reason: 'invalid_token' })

    const response = await PATCH(buildRequest({ action: 'accept' }), PARAMS)

    expect(response.status).toBe(403)
  })
})

// Stamping behavior tests
describe('PATCH /api/vendor/orders/[orderId] - delivery stamping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockResolvedValue(VENDOR)
    isVendorOnboardedMock.mockResolvedValue(true)
    mockVendorStore()
    mockOrderWithUser()
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: {
        email: 'buyer@example.invalid',
        profile: { firstName: 'Fake', lastName: 'Buyer' },
      },
      items: [{ productId: 'prod_1' }],
    })
    // Mock $transaction to capture the callback
    prismaMock.$transaction = vi.fn(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'SHIPPED',
            fulfillmentStatus: 'SHIPPED',
            vendorAccepted: false,
            vendorRejected: false,
            vendorRejectionReason: null,
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([{ id: 'item_1' }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return cb(tx)
    })
  })

  it('stamps shippedAt when status transitions to SHIPPED via status path', async () => {
    mockExistingOrder({ status: 'PROCESSING', fulfillmentStatus: 'PROCESSING' })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(200)
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        storeId: 'store_1',
        field: 'shippedAt',
        now: expect.any(Date),
      })
    )
  })

  it('stamps shippedAt when fulfillmentStatus transitions to SHIPPED', async () => {
    mockExistingOrder({ status: 'PROCESSING', fulfillmentStatus: 'PROCESSING' })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ fulfillmentStatus: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(200)
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        storeId: 'store_1',
        field: 'shippedAt',
        now: expect.any(Date),
      })
    )
  })

  it('stamps deliveredAt (and shippedAt) when status transitions to DELIVERED', async () => {
    mockExistingOrder({ status: 'SHIPPED', fulfillmentStatus: 'SHIPPED' })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ status: 'DELIVERED' }), PARAMS)

    expect(response.status).toBe(200)
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        storeId: 'store_1',
        field: 'deliveredAt',
        now: expect.any(Date),
      })
    )
  })

  it('stamps deliveredAt when fulfillmentStatus transitions to DELIVERED', async () => {
    mockExistingOrder({ status: 'SHIPPED', fulfillmentStatus: 'SHIPPED' })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ fulfillmentStatus: 'DELIVERED' }), PARAMS)

    expect(response.status).toBe(200)
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        storeId: 'store_1',
        field: 'deliveredAt',
        now: expect.any(Date),
      })
    )
  })

  it('does not stamp for COMPLETED alone', async () => {
    mockExistingOrder({ status: 'DELIVERED', fulfillmentStatus: 'DELIVERED' })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ status: 'COMPLETED' }), PARAMS)

    expect(response.status).toBe(200)
    // stampOrderItems should not be called for COMPLETED transition
    expect(stampOrderItemsMock).not.toHaveBeenCalled()
  })

  it('does not stamp for multi-store orders', async () => {
    // Override $transaction to return count > 0 for other stores
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'SHIPPED',
            fulfillmentStatus: 'SHIPPED',
            vendorAccepted: false,
            vendorRejected: false,
            vendorRejectionReason: null,
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(1), // has items from other stores
          findMany: vi.fn().mockResolvedValue([{ id: 'item_1' }]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }
      return cb(tx)
    })

    mockExistingOrder({ status: 'PROCESSING', fulfillmentStatus: 'PROCESSING' })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(200)
    // stampOrderItems is called but returns 0 for multi-store orders (no items updated)
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        storeId: 'store_1',
        field: 'shippedAt',
        now: expect.any(Date),
      })
    )
  })

  it('does not stamp for rejected orders', async () => {
    mockExistingOrder({ status: 'PROCESSING', vendorRejected: true, vendorRejectionReason: 'out of stock' })

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(400)
    expect(stampOrderItemsMock).not.toHaveBeenCalled()
  })

  it('does not stamp for cancelled orders', async () => {
    mockExistingOrder({ status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' })

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(400)
    expect(stampOrderItemsMock).not.toHaveBeenCalled()
  })

  it('stamp failure rolls back status change', async () => {
    mockExistingOrder({ status: 'PROCESSING', fulfillmentStatus: 'PROCESSING' })
    // Make stampOrderItems throw to simulate failure
    stampOrderItemsMock.mockRejectedValueOnce(new Error('stamp failed'))
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'SHIPPED',
            fulfillmentStatus: 'SHIPPED',
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([{ id: 'item_1' }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(500)
    await expect(prismaMock.$transaction.mock.results[0].value).rejects.toThrow()
    // Restore mock for other tests
    stampOrderItemsMock.mockResolvedValue(1)
  })

  it('stamp failure rolls back fulfillmentStatus change', async () => {
    mockExistingOrder({ status: 'PROCESSING', fulfillmentStatus: 'PROCESSING' })
    // Make stampOrderItems throw to simulate failure
    stampOrderItemsMock.mockRejectedValueOnce(new Error('stamp failed'))
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'PROCESSING',
            fulfillmentStatus: 'SHIPPED',
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([{ id: 'item_1' }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
    })

    const response = await PATCH(buildRequest({ fulfillmentStatus: 'SHIPPED' }), PARAMS)

    expect(response.status).toBe(500)
    await expect(prismaMock.$transaction.mock.results[0].value).rejects.toThrow()
    // Restore mock for other tests
    stampOrderItemsMock.mockResolvedValue(1)
  })

  it('legacy behaviour unchanged: same responses, statuses, events, emails for valid transition', async () => {
    mockExistingOrder({ status: 'PENDING', fulfillmentStatus: 'PENDING' })
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({
            id: 'order_1',
            status: 'PROCESSING',
            fulfillmentStatus: 'PROCESSING',
            vendorAccepted: false,
            vendorRejected: false,
            vendorRejectionReason: null,
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'buyer_1',
      user: { email: 'buyer@example.invalid', profile: { firstName: 'Fake', lastName: 'Buyer' } },
      items: [{ product: { name: 'Test Product' } }],
    })

    const response = await PATCH(buildRequest({ status: 'PROCESSING' }), PARAMS)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.order.status).toBe('PROCESSING')
    expect(body.order.fulfillmentStatus).toBe('PROCESSING')
    // Email should still be sent
    expect(sendOrderStatusUpdateEmailMock).toHaveBeenCalledWith(
      'buyer@example.invalid',
      'Fake',
      'order_1',
      'PROCESSING'
    )
    // Fulfillment event should be recorded
    expect(recordFulfillmentEventMock).toHaveBeenCalledWith(
      'order_1',
      'PROCESSING',
      'vendor_1',
      expect.objectContaining({ productName: 'Test Product' })
    )
  })
})

// Body-injection tests
describe('PATCH /api/vendor/orders/[orderId] - body injection rejection', () => {
  const injectedBody = {
    status: 'SHIPPED',
    deliveryConfirmedAt: '2020-01-01T00:00:00.000Z',
    deliveryConfirmedBy: 'CUSTOMER',
    shippedAt: '2020-01-01T00:00:00.000Z',
    deliveredAt: '2020-01-01T00:00:00.000Z',
  }

  let orderUpdateCalls: any[] = []
  let itemUpdateManyCalls: any[] = []
  let stampCalls: any[] = []
  let startedAt = 0

  function assertNoInjectedWrite(data: any) {
    expect(data).not.toHaveProperty('deliveryConfirmedAt')
    expect(data).not.toHaveProperty('deliveryConfirmedBy')
    expect(data).not.toHaveProperty('shippedAt')
    expect(data).not.toHaveProperty('deliveredAt')
  }

  beforeEach(() => {
    startedAt = Date.now()
    vi.clearAllMocks()
    verifyTokenMock.mockResolvedValue(VENDOR)
    isVendorOnboardedMock.mockResolvedValue(true)
    mockVendorStore()
    mockExistingOrder({ status: 'PROCESSING', fulfillmentStatus: 'PROCESSING' })
    mockOrderWithUser()
    orderUpdateCalls = []
    itemUpdateManyCalls = []
    stampCalls = []
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn((args: any) => {
            orderUpdateCalls.push(args)
            return Promise.resolve({
              id: 'order_1',
              status: 'SHIPPED',
              fulfillmentStatus: 'SHIPPED',
              vendorAccepted: false,
              vendorRejected: false,
              vendorRejectionReason: null,
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            })
          }),
        },
        orderItem: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([{ id: 'item_1' }]),
          updateMany: vi.fn((args: any) => {
            itemUpdateManyCalls.push(args)
            return Promise.resolve({ count: 0 })
          }),
        },
      }
      return cb(tx)
    })
    stampOrderItemsMock.mockImplementation(async (opts: any) => {
      stampCalls.push(opts)
      return 1
    })
  })

  it('status path: order.update never receives deliveryConfirmedAt/deliveryConfirmedBy or shippedAt/deliveredAt from the body', async () => {
    const response = await PATCH(buildRequest({ ...injectedBody }), PARAMS)
    expect(response.status).toBe(200)

    expect(orderUpdateCalls.length).toBeGreaterThan(0)
    for (const call of orderUpdateCalls) {
      assertNoInjectedWrite(call.data)
    }
    // No direct orderItem.updateMany write carries injected timestamps either
    for (const call of itemUpdateManyCalls) {
      assertNoInjectedWrite(call.data)
      if (call.data.shippedAt !== undefined) {
        expect(call.data.shippedAt).toBeInstanceOf(Date)
      }
      if (call.data.deliveredAt !== undefined) {
        expect(call.data.deliveredAt).toBeInstanceOf(Date)
      }
    }
  })

  it('status path: shippedAt is stamped from the server clock, not the body', async () => {
    const response = await PATCH(buildRequest({ ...injectedBody }), PARAMS)
    expect(response.status).toBe(200)

    const shippedStamps = stampCalls.filter(call => call.field === 'shippedAt')
    expect(shippedStamps.length).toBeGreaterThan(0)
    for (const call of stampCalls) {
      expect(['shippedAt', 'deliveredAt']).toContain(call.field)
      expect(call.now).toBeInstanceOf(Date)
      expect(call.now.getTime()).toBeGreaterThanOrEqual(startedAt)
      expect(call.now).not.toBe(injectedBody.shippedAt)
      expect(call.now).not.toBe(injectedBody.deliveredAt)
    }
  })

  it('fulfillmentStatus path: order.update never receives deliveryConfirmedAt/deliveryConfirmedBy or shippedAt/deliveredAt from the body', async () => {
    const fulfillmentBody = { fulfillmentStatus: 'SHIPPED', ...injectedBody }
    const response = await PATCH(buildRequest(fulfillmentBody), PARAMS)
    expect(response.status).toBe(200)

    expect(orderUpdateCalls.length).toBeGreaterThan(0)
    for (const call of orderUpdateCalls) {
      assertNoInjectedWrite(call.data)
    }
    for (const call of itemUpdateManyCalls) {
      assertNoInjectedWrite(call.data)
    }
  })

  it('fulfillmentStatus path: shippedAt is stamped from the server clock, not the body', async () => {
    const fulfillmentBody = { ...injectedBody, fulfillmentStatus: 'SHIPPED' }
    const response = await PATCH(buildRequest(fulfillmentBody), PARAMS)
    expect(response.status).toBe(200)

    const shippedStamps = stampCalls.filter(call => call.field === 'shippedAt')
    expect(shippedStamps.length).toBeGreaterThan(0)
    for (const call of stampCalls) {
      expect(['shippedAt', 'deliveredAt']).toContain(call.field)
      expect(call.now).toBeInstanceOf(Date)
      expect(call.now.getTime()).toBeGreaterThanOrEqual(startedAt)
    }
  })
})
