import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
  },
  orderItem: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

const requireSuperAdminMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/adminAuth', () => ({
  requireSuperAdmin: requireSuperAdminMock,
}))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: createAuditLogMock,
}))

import { POST } from '@/app/api/admin/orders/[id]/items/[itemId]/confirm-delivery/route'

const SUPER_ADMIN = { userId: 'admin_1', role: 'SUPER_ADMIN' }
const ORDER_ID = 'order_1'
const ITEM_ID = 'item_1'

function buildRequest(body: unknown = {}): NextRequest {
  return new NextRequest(`http://localhost/api/admin/orders/${ORDER_ID}/items/${ITEM_ID}/confirm-delivery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PARAMS = { params: { id: ORDER_ID, itemId: ITEM_ID } }

describe('POST /api/admin/orders/[id]/items/[itemId]/confirm-delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSuperAdminMock.mockResolvedValue(SUPER_ADMIN)
  })

  it('returns 401 when not authenticated', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await POST(buildRequest({ reason: 'test' }), PARAMS)
    expect(response.status).toBe(401)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 403 for ADMIN role (not SUPER_ADMIN)', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await POST(buildRequest({ reason: 'test' }), PARAMS)
    expect(response.status).toBe(403)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 403 for VENDOR role', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await POST(buildRequest({ reason: 'test' }), PARAMS)
    expect(response.status).toBe(403)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 403 for CUSTOMER role', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await POST(buildRequest({ reason: 'test' }), PARAMS)
    expect(response.status).toBe(403)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 400 when reason is missing', async () => {
    const response = await POST(buildRequest({ reason: '' }), PARAMS)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Reason is required for admin delivery confirmation')
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 400 when reason is not provided', async () => {
    const response = await POST(buildRequest({}), PARAMS)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Reason is required for admin delivery confirmation')
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 404 when order not found', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null)

    const response = await POST(buildRequest({ reason: 'test' }), PARAMS)
    expect(response.status).toBe(404)
  })

  it('returns 404 when item not found or not delivered', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, status: 'DELIVERED', paymentStatus: 'PAID' })
    prismaMock.orderItem.findFirst.mockResolvedValue(null)

    const response = await POST(buildRequest({ reason: 'test' }), PARAMS)
    expect(response.status).toBe(404)
  })

  it('confirms delivery for valid item with reason', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, status: 'DELIVERED', paymentStatus: 'PAID' })
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: ITEM_ID,
      deliveredAt: new Date('2026-01-10T10:00:00.000Z'),
      deliveryConfirmedAt: null,
    })
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.orderItem.findUnique.mockResolvedValue({
      id: ITEM_ID,
      deliveryConfirmedAt: new Date('2026-01-15T10:00:00.000Z'),
    })

    const response = await POST(buildRequest({ reason: 'Customer confirmed via phone' }), PARAMS)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.item.deliveryConfirmedBy).toBe('ADMIN')
    expect(body.alreadyConfirmed).toBe(false)
  })

  it('is idempotent: returns existing confirmation on repeat', async () => {
    const existingConfirmed = new Date('2026-01-12T15:00:00.000Z')
    prismaMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, status: 'DELIVERED', paymentStatus: 'PAID' })
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: ITEM_ID,
      deliveredAt: new Date('2026-01-10T10:00:00.000Z'),
      deliveryConfirmedAt: existingConfirmed,
    })

    const response = await POST(buildRequest({ reason: 'test' }), PARAMS)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.alreadyConfirmed).toBe(true)
    expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled()
  })

  it('creates audit log with reason', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, status: 'DELIVERED', paymentStatus: 'PAID' })
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: ITEM_ID,
      deliveredAt: new Date('2026-01-10T10:00:00.000Z'),
      deliveryConfirmedAt: null,
    })
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.orderItem.findUnique.mockResolvedValue({
      id: ITEM_ID,
      deliveryConfirmedAt: new Date('2026-01-15T10:00:00.000Z'),
    })

    await POST(buildRequest({ reason: 'Customer confirmed via phone' }), PARAMS)

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin_1',
        userRole: 'SUPER_ADMIN',
        action: 'DELIVERY_CONFIRMED_ADMIN',
        entityType: 'ORDER_ITEM',
        entityId: ITEM_ID,
        afterData: expect.objectContaining({
          orderId: ORDER_ID,
          deliveryConfirmedBy: 'ADMIN',
          reason: 'Customer confirmed via phone',
        }),
      })
    )
  })
})