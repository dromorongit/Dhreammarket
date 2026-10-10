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
