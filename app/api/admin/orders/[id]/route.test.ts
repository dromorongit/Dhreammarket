import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
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
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'SHIPPED' },
    })
  })

  it("still updates a non-refund paymentStatus such as 'FAILED'", async () => {
    const response = await PATCH(buildRequest({ paymentStatus: 'FAILED' }), { params: { id: 'order_1' } })

    expect(response.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { paymentStatus: 'FAILED' },
    })
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
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'CANCELLED' },
    })
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
