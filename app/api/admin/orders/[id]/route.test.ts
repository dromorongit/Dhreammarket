import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  orderItem: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/stock-reservation', () => ({
  releaseStock: vi.fn().mockResolvedValue({ success: true }),
  consumeInventory: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

// Mock the stampOrderItems function
const stampOrderItemsMock = vi.hoisted(() => vi.fn().mockResolvedValue(1))
vi.mock('@/lib/order-delivery-stamps', () => ({
  stampOrderItems: stampOrderItemsMock,
}))

import { PATCH } from '@/app/api/admin/orders/[id]/route'
import { requireAdmin } from '@/lib/adminAuth'
import { releaseStock } from '@/lib/stock-reservation'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog } from '@/lib/audit-log'

const ADMIN = { userId: 'admin_1', role: 'SUPER_ADMIN' }

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/orders/order_1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN as never)
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({ id: 'order_1', status: 'PROCESSING', paymentStatus: 'PAID' }),
        },
        orderItem: {
          findMany: vi.fn().mockResolvedValue([{ product: { storeId: 'store_1' } }]),
          count: vi.fn().mockResolvedValue(0),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.update.mockResolvedValue({ id: 'order_1', status: 'PROCESSING', paymentStatus: 'PAID' })
  })

  it('returns the auth failure when the caller is not an admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as never
    )

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(401)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it("returns 400 for paymentStatus 'REFUNDED' and points at POST /api/admin/refunds", async () => {
    const response = await PATCH(buildRequest({ paymentStatus: 'REFUNDED' }), {
      params: { id: 'order_1' },
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('POST /api/admin/refunds')
    expect(body.endpoint).toBe('POST /api/admin/refunds')
    // Nothing was written.
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null)

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), { params: { id: 'missing' } })

    expect(response.status).toBe(404)
  })

  it("still updates a fulfilment status such as 'SHIPPED'", async () => {
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(200)
    // order.update is called inside transaction
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it("still updates a non-refund paymentStatus such as 'FAILED'", async () => {
    const response = await PATCH(buildRequest({ paymentStatus: 'FAILED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('returns 400 when there is nothing valid to update', async () => {
    const response = await PATCH(buildRequest({ note: 'hello' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(400)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })
})

// Characterization of the admin cancellation path (PATCH status: 'CANCELLED').
// Pinned current behaviour: an admin can cancel from ANY current status, the
// fulfillment event and audit log are written, and stock is released for
// NORMAL orders only. This task does not change this route (report-only).
describe('PATCH /api/admin/orders/[id] - cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN as never)
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({ id: 'order_1', status: 'CANCELLED', paymentStatus: 'PAID' }),
        },
        orderItem: {
          findMany: vi.fn().mockResolvedValue([{ product: { storeId: 'store_1' } }]),
          count: vi.fn().mockResolvedValue(0),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.update.mockResolvedValue({ id: 'order_1', status: 'CANCELLED', paymentStatus: 'PAID' })
  })

  it('cancels from any current status, with no transition guard', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'SHIPPED',
      paymentStatus: 'PAID',
    })

    const response = await PATCH(buildRequest({ status: 'CANCELLED', reason: 'fraud review' }), {
      params: { id: 'order_1' },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('records a CANCELLED fulfillment event, using a default description when no reason is given', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })

    await PATCH(buildRequest({ status: 'CANCELLED' }), { params: { id: 'order_1' } })

    expect(recordFulfillmentEvent).toHaveBeenCalledWith('order_1', 'CANCELLED', undefined, {
      description: 'Order cancelled by administrator',
    })
  })

  it('records a CANCELLED fulfillment event with the supplied reason', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })

    await PATCH(buildRequest({ status: 'CANCELLED', reason: 'buyer asked support' }), {
      params: { id: 'order_1' },
    })

    expect(recordFulfillmentEvent).toHaveBeenCalledWith('order_1', 'CANCELLED', undefined, {
      description: 'buyer asked support',
    })
  })

  it('creates an ORDER_CANCELLED audit log entry', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })

    await PATCH(buildRequest({ status: 'CANCELLED' }), { params: { id: 'order_1' } })

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin_1',
        userRole: 'SUPER_ADMIN',
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: 'order_1',
      })
    )
  })

  it('releases stock when a NORMAL order is cancelled', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })

    await PATCH(buildRequest({ status: 'CANCELLED' }), { params: { id: 'order_1' } })

    expect(releaseStock).toHaveBeenCalledWith('order_1')
  })

  it('does not release stock when a non-NORMAL order is cancelled', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'PREORDER',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })

    await PATCH(buildRequest({ status: 'CANCELLED' }), { params: { id: 'order_1' } })

    expect(releaseStock).not.toHaveBeenCalled()
  })
})

// Stamping behavior tests
describe('PATCH /api/admin/orders/[id] - delivery stamping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN as never)
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({ id: 'order_1', status: 'SHIPPED', paymentStatus: 'PAID' }),
        },
        orderItem: {
          findMany: vi.fn().mockResolvedValue([{ product: { storeId: 'store_1' } }]),
          count: vi.fn().mockResolvedValue(0),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.update.mockResolvedValue({ id: 'order_1', status: 'SHIPPED', paymentStatus: 'PAID' })
  })

  it('stamps shippedAt for single-store order when status transitions to SHIPPED', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })
    prismaMock.orderItem.findMany.mockResolvedValue([
      { product: { storeId: 'store_1' } },
    ])

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), { params: { id: 'order_1' } })

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

  it('stamps deliveredAt for single-store order when status transitions to DELIVERED', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'SHIPPED',
      paymentStatus: 'PAID',
    })
    prismaMock.orderItem.findMany.mockResolvedValue([
      { product: { storeId: 'store_1' } },
    ])

    const response = await PATCH(buildRequest({ status: 'DELIVERED' }), { params: { id: 'order_1' } })

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

  it('does not stamp for multi-store orders', async () => {
    // Override $transaction to return multiple storeIds
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn().mockResolvedValue({ id: 'order_1', status: 'SHIPPED', paymentStatus: 'PAID' }),
        },
        orderItem: {
          findMany: vi.fn().mockResolvedValue([
            { product: { storeId: 'store_1' } },
            { product: { storeId: 'store_2' } },
          ]),
          count: vi.fn().mockResolvedValue(0),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }
      return cb(tx)
    })

    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(200)
    expect(stampOrderItemsMock).not.toHaveBeenCalled()
  })

  it('does not stamp for COMPLETED alone', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'DELIVERED',
      paymentStatus: 'PAID',
    })
    prismaMock.orderItem.findMany.mockResolvedValue([
      { product: { storeId: 'store_1' } },
    ])

    const response = await PATCH(buildRequest({ status: 'COMPLETED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(200)
    expect(stampOrderItemsMock).not.toHaveBeenCalled()
  })

  it('never sets deliveryConfirmedAt/deliveryConfirmedBy (only through dedicated endpoint)', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'SHIPPED',
      paymentStatus: 'PAID',
    })
    prismaMock.orderItem.findMany.mockResolvedValue([
      { product: { storeId: 'store_1' } },
    ])

    const response = await PATCH(buildRequest({ status: 'DELIVERED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(200)
    // Verify stampOrderItems was called with deliveredAt only, not deliveryConfirmedAt
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'deliveredAt' })
    )
    expect(stampOrderItemsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ field: 'deliveryConfirmedAt' })
    )
  })

  it('stamp failure rolls back status change', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })
    stampOrderItemsMock.mockRejectedValueOnce(new Error('stamp failed'))
    const failingTx = {
      order: {
        update: vi.fn().mockResolvedValue({ id: 'order_1', status: 'SHIPPED', paymentStatus: 'PAID' }),
      },
      orderItem: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([{ product: { storeId: 'store_1' } }]),
        updateMany: vi.fn(),
      },
    }
    prismaMock.$transaction = vi.fn(async (cb: any) => cb(failingTx))

    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(500)
    await expect(prismaMock.$transaction.mock.results[0].value).rejects.toThrow()
    stampOrderItemsMock.mockResolvedValue(1)
  })
})

// Body-injection tests for admin route
describe('PATCH /api/admin/orders/[id] - body injection rejection', () => {
  const injectedBody = {
    status: 'SHIPPED',
    deliveryConfirmedAt: '2020-01-01T00:00:00.000Z',
    deliveryConfirmedBy: 'CUSTOMER',
    shippedAt: '2020-01-01T00:00:00.000Z',
    deliveredAt: '2020-01-01T00:00:00.000Z',
  }

  let orderUpdateCalls: any[] = []
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
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN as never)
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderType: 'NORMAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    })
    orderUpdateCalls = []
    stampCalls = []
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          update: vi.fn((args: any) => {
            orderUpdateCalls.push(args)
            return Promise.resolve({ id: 'order_1', status: 'SHIPPED', paymentStatus: 'PAID' })
          }),
        },
        orderItem: {
          findMany: vi.fn().mockResolvedValue([{ product: { storeId: 'store_1' } }]),
          count: vi.fn().mockResolvedValue(0),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return cb(tx)
    })
    prismaMock.order.update.mockResolvedValue({ id: 'order_1', status: 'SHIPPED', paymentStatus: 'PAID' })
    stampOrderItemsMock.mockImplementation(async (opts: any) => {
      stampCalls.push(opts)
      return 1
    })
  })

  it('order.update never receives deliveryConfirmedAt/deliveryConfirmedBy or shippedAt/deliveredAt from the body', async () => {
    const response = await PATCH(buildRequest(injectedBody), { params: { id: 'order_1' } })
    expect(response.status).toBe(200)

    expect(orderUpdateCalls.length).toBeGreaterThan(0)
    for (const call of orderUpdateCalls) {
      assertNoInjectedWrite(call.data)
    }
  })

  it('shippedAt/deliveredAt stamps come from the server clock, not the body', async () => {
    const response = await PATCH(buildRequest(injectedBody), { params: { id: 'order_1' } })
    expect(response.status).toBe(200)

    expect(stampCalls.length).toBeGreaterThan(0)
    for (const call of stampCalls) {
      expect(['shippedAt', 'deliveredAt']).toContain(call.field)
      expect(call.now).toBeInstanceOf(Date)
      expect(call.now.getTime()).toBeGreaterThanOrEqual(startedAt)
      expect(call.now).not.toBe(injectedBody.shippedAt)
      expect(call.now).not.toBe(injectedBody.deliveredAt)
    }
  })
})
