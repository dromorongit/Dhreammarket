import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  orderItem: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: verifyTokenMock,
}))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: createAuditLogMock,
}))

import { POST } from '@/app/api/orders/[orderId]/items/[itemId]/confirm-delivery/route'

const CUSTOMER = { authenticated: true, userId: 'customer_1', role: 'CUSTOMER', sessionId: 'sess_c' }
const ORDER_ID = 'order_1'
const ITEM_ID = 'item_1'
const OTHER_USER = 'other_user'

function buildRequest(body: unknown = {}): NextRequest {
  return new NextRequest(`http://localhost/api/orders/${ORDER_ID}/items/${ITEM_ID}/confirm-delivery`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'token=test-token',
    },
    body: JSON.stringify(body),
  })
}

const PARAMS = { params: { orderId: ORDER_ID, itemId: ITEM_ID } }

function anOwnedOrder() {
  return { id: ORDER_ID, userId: 'customer_1', status: 'DELIVERED', paymentStatus: 'PAID' }
}

function aDeliveredItem() {
  return {
    id: ITEM_ID,
    deliveredAt: new Date('2026-01-10T10:00:00.000Z'),
    deliveryConfirmedAt: null,
  }
}

describe('POST /api/orders/[orderId]/items/[itemId]/confirm-delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockResolvedValue(CUSTOMER)
  })

  it('returns 401 when no token', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: false, reason: 'no token' })

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(401)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('returns 403 when user is not a customer', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'vendor_1', role: 'VENDOR', sessionId: 'sess_v' })

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(403)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not exist and writes nothing', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller does not own the order and writes nothing', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: ORDER_ID,
      userId: OTHER_USER,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
    })
    prismaMock.orderItem.findFirst.mockResolvedValue(aDeliveredItem())

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 when the item belongs to a different order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(anOwnedOrder())
    // Item exists but belongs to a different order - findFirst with the orderId filter returns null
    prismaMock.orderItem.findFirst.mockResolvedValue(null)

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 when the item has no deliveredAt', async () => {
    prismaMock.order.findFirst.mockResolvedValue(anOwnedOrder())
    // Item with no deliveredAt is not found by the query (deliveredAt: { not: null })
    prismaMock.orderItem.findFirst.mockResolvedValue(null)

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it("owner's request calls updateMany with where { id, orderId, deliveryConfirmedAt: null } and data containing deliveryConfirmedBy 'CUSTOMER'", async () => {
    prismaMock.order.findFirst.mockResolvedValue(anOwnedOrder())
    prismaMock.orderItem.findFirst.mockResolvedValue(aDeliveredItem())
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.orderItem.findUnique.mockResolvedValue({
      id: ITEM_ID,
      deliveryConfirmedAt: new Date('2026-01-15T10:00:00.000Z'),
    })

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(200)

    expect(prismaMock.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: ITEM_ID,
        orderId: ORDER_ID,
        deliveryConfirmedAt: null,
      },
      data: {
        deliveryConfirmedAt: expect.any(Date),
        deliveryConfirmedBy: 'CUSTOMER',
      },
    })
  })

  it('confirms delivery for valid item', async () => {
    prismaMock.order.findFirst.mockResolvedValue(anOwnedOrder())
    prismaMock.orderItem.findFirst.mockResolvedValue(aDeliveredItem())
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.orderItem.findUnique.mockResolvedValue({
      id: ITEM_ID,
      deliveryConfirmedAt: new Date('2026-01-15T10:00:00.000Z'),
    })

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.item.deliveryConfirmedBy).toBe('CUSTOMER')
    expect(body.alreadyConfirmed).toBe(false)

    expect(prismaMock.orderItem.updateMany).toHaveBeenCalledWith({
      where: { id: ITEM_ID, orderId: ORDER_ID, deliveryConfirmedAt: null },
      data: { deliveryConfirmedAt: expect.any(Date), deliveryConfirmedBy: 'CUSTOMER' },
    })
  })

  it('is idempotent: returns existing confirmation on repeat', async () => {
    const existingConfirmed = new Date('2026-01-12T15:00:00.000Z')
    prismaMock.order.findFirst.mockResolvedValue(anOwnedOrder())
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: ITEM_ID,
      deliveredAt: new Date('2026-01-10T10:00:00.000Z'),
      deliveryConfirmedAt: existingConfirmed,
    })

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.item.deliveryConfirmedAt).toEqual(existingConfirmed.toISOString())
    expect(body.alreadyConfirmed).toBe(true)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('returns alreadyConfirmed when updateMany reports count 0 (race lost)', async () => {
    prismaMock.order.findFirst.mockResolvedValue(anOwnedOrder())
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: ITEM_ID,
      deliveredAt: new Date('2026-01-10T10:00:00.000Z'),
      deliveryConfirmedAt: null,
    })
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.orderItem.findUnique.mockResolvedValue({
      deliveryConfirmedAt: new Date('2026-01-15T10:00:00.000Z'),
    })

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.alreadyConfirmed).toBe(true)
    expect(prismaMock.orderItem.updateMany).toHaveBeenCalledTimes(1)
  })

  it('rejects cancelled order', async () => {
    // Order with CANCELLED status is excluded by the notIn filter, so findFirst returns null
    prismaMock.order.findFirst.mockResolvedValue(null)

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('rejects refunded order', async () => {
    // Order with REFUNDED paymentStatus is excluded by the notIn filter, so findFirst returns null
    prismaMock.order.findFirst.mockResolvedValue(null)

    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('creates audit log on confirmation', async () => {
    prismaMock.order.findFirst.mockResolvedValue(anOwnedOrder())
    prismaMock.orderItem.findFirst.mockResolvedValue(aDeliveredItem())
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.orderItem.findUnique.mockResolvedValue({
      id: ITEM_ID,
      deliveryConfirmedAt: new Date('2026-01-15T10:00:00.000Z'),
    })

    await POST(buildRequest(), PARAMS)

    // Audit log is called with .catch() so it's fire-and-forget, but the call
    // itself is issued synchronously while handling the request
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer_1',
        userRole: 'CUSTOMER',
        action: 'DELIVERY_CONFIRMED',
        entityType: 'ORDER_ITEM',
        entityId: ITEM_ID,
      })
    )
  })
})
