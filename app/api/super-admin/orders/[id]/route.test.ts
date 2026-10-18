import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  order: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  orderItem: {
    deleteMany: vi.fn(),
  },
  payment: {
    deleteMany: vi.fn(),
  },
  productReview: {
    deleteMany: vi.fn(),
  },
  vendorReview: {
    deleteMany: vi.fn(),
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

import { DELETE } from '@/app/api/super-admin/orders/[id]/route'

const SUPER_ADMIN = { userId: 'admin_1', role: 'SUPER_ADMIN' }
const ORDER_ID = 'order_1234567890abcdef'
const PREFIX = ORDER_ID.slice(0, 8)

const anUnpaidOrder = () => ({
  id: ORDER_ID,
  paymentStatus: 'PENDING',
  refunds: [],
  items: [
    { id: 'item_1', returnRequests: [], payoutItems: [], balanceAdjustments: [] },
  ],
})

function buildRequest() {
  return new NextRequest(`http://localhost/api/super-admin/orders/${ORDER_ID}`, {
    method: 'DELETE',
  })
}

const PARAMS = { params: { id: ORDER_ID } }

function expectNoDeleteCalls() {
  expect(prismaMock.orderItem.deleteMany).not.toHaveBeenCalled()
  expect(prismaMock.payment.deleteMany).not.toHaveBeenCalled()
  expect(prismaMock.productReview.deleteMany).not.toHaveBeenCalled()
  expect(prismaMock.vendorReview.deleteMany).not.toHaveBeenCalled()
  expect(prismaMock.order.delete).not.toHaveBeenCalled()
}

function expectRefusalAudit(reasonContains: string) {
  expect(createAuditLogMock).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: 'admin_1',
      userRole: 'SUPER_ADMIN',
      action: 'ORDER_DELETE_REFUSED',
      entityType: 'ORDER',
      entityId: PREFIX,
      afterData: expect.objectContaining({
        orderId: PREFIX,
        actorId: 'admin_1',
        reason: expect.stringContaining(reasonContains),
      }),
    })
  )
}

describe('DELETE /api/super-admin/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSuperAdminMock.mockResolvedValue(SUPER_ADMIN)
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        payment: { deleteMany: prismaMock.payment.deleteMany },
        orderItem: { deleteMany: prismaMock.orderItem.deleteMany },
        productReview: { deleteMany: prismaMock.productReview.deleteMany },
        vendorReview: { deleteMany: prismaMock.vendorReview.deleteMany },
        order: { delete: prismaMock.order.delete },
      }
      return fn(tx)
    })
  })

  it('deletes an unpaid order, audits the deletion, and deletes only non-paid payments', async () => {
    prismaMock.order.findUnique.mockResolvedValue(anUnpaidOrder())
    prismaMock.payment.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.orderItem.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.productReview.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.vendorReview.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.order.delete.mockResolvedValue({ id: ORDER_ID })

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    expect(prismaMock.payment.deleteMany).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID, status: { in: ['PENDING', 'FAILED', 'CANCELLED'] } },
    })
    expect(prismaMock.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: ORDER_ID } })
    expect(prismaMock.productReview.deleteMany).toHaveBeenCalledWith({ where: { orderId: ORDER_ID } })
    expect(prismaMock.vendorReview.deleteMany).toHaveBeenCalledWith({ where: { orderId: ORDER_ID } })
    expect(prismaMock.order.delete).toHaveBeenCalledWith({ where: { id: ORDER_ID } })

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin_1',
        userRole: 'SUPER_ADMIN',
        action: 'ORDER_DELETED',
        entityType: 'ORDER',
        entityId: PREFIX,
        afterData: expect.objectContaining({
          orderId: PREFIX,
          actorId: 'admin_1',
          reason: 'order deleted',
        }),
      })
    )
  })

  it('refuses a PAID order with 409, deletes nothing, and audits the refusal', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...anUnpaidOrder(),
      paymentStatus: 'PAID',
    })

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('PAID')

    expectNoDeleteCalls()
    expectRefusalAudit('PAID')
  })

  it('refuses a REFUNDED order with 409, deletes nothing, and audits the refusal', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...anUnpaidOrder(),
      paymentStatus: 'REFUNDED',
    })

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('REFUNDED')

    expectNoDeleteCalls()
    expectRefusalAudit('REFUNDED')
  })

  it('refuses an order with a refund row with 409, deletes nothing, and audits the refusal', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...anUnpaidOrder(),
      refunds: [{ id: 'ref_1', orderId: ORDER_ID }],
    })

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('refunds')

    expectNoDeleteCalls()
    expectRefusalAudit('refund rows')
  })

  it('refuses an order with a payout item with 409, deletes nothing, and audits the refusal', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...anUnpaidOrder(),
      items: [
        {
          id: 'item_1',
          returnRequests: [],
          payoutItems: [{ id: 'pi_1' }],
          balanceAdjustments: [],
        },
      ],
    })

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('payout items')

    expectNoDeleteCalls()
    expectRefusalAudit('payout items')
  })

  it('returns 404 when the order does not exist and deletes nothing', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null)

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
    expectNoDeleteCalls()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 401 when not authenticated', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(401)
    expectNoDeleteCalls()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 403 for ADMIN role', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(403)
    expectNoDeleteCalls()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 403 for VENDOR role', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(403)
    expectNoDeleteCalls()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('returns 403 for CUSTOMER role', async () => {
    requireSuperAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(403)
    expectNoDeleteCalls()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('still deletes when the audit write fails', async () => {
    createAuditLogMock.mockRejectedValueOnce(new Error('audit down'))
    prismaMock.order.findUnique.mockResolvedValue(anUnpaidOrder())
    prismaMock.order.delete.mockResolvedValue({ id: ORDER_ID })

    const response = await DELETE(buildRequest(), PARAMS)
    expect(response.status).toBe(200)
    expect(prismaMock.order.delete).toHaveBeenCalledTimes(1)
  })
})
