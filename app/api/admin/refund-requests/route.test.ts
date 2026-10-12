import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Tests for GET /api/admin/refund-requests. All data below is obviously fake.

const prismaMock = vi.hoisted(() => ({
  order: {
    findMany: vi.fn(),
  },
  fulfillmentEvent: {
    findMany: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

const auth = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({
  requireSuperAdmin: auth.requireSuperAdmin,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => () => ({ success: true })),
}))

import { GET } from '@/app/api/admin/refund-requests/route'

const SUPER_ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' }

function buildRequest(url = 'http://localhost/api/admin/refund-requests'): NextRequest {
  return new NextRequest(url, { method: 'GET' })
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    status: 'CANCELLED',
    paymentStatus: 'PAID',
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    total: 120,
    walletAmountApplied: 0,
    orderType: 'NORMAL',
    payment: { currency: 'GHS' },
    items: [{ product: { store: { name: 'Fake Store' } } }],
    refunds: [],
    ...overrides,
  }
}

/** The only fields the queue item is allowed to expose. */
const ITEM_KEYS = [
  'orderId',
  'orderRef',
  'cancelledAt',
  'requestSource',
  'total',
  'currency',
  'walletAssisted',
  'orderType',
  'storeName',
  'ageDays',
  'refundStatus',
].sort()

describe('GET /api/admin/refund-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.requireSuperAdmin.mockResolvedValue(SUPER_ADMIN as never)
    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.fulfillmentEvent.findMany.mockResolvedValue([])
    prismaMock.auditLog.findMany.mockResolvedValue([])
  })

  it('returns 401 when nobody is signed in', async () => {
    auth.requireSuperAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }) as never
    )

    const response = await GET(buildRequest())

    expect(response.status).toBe(401)
    expect(prismaMock.order.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 for a plain ADMIN', async () => {
    auth.requireSuperAdmin.mockResolvedValue(
      NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }) as never
    )

    const response = await GET(buildRequest())

    expect(response.status).toBe(403)
    expect(prismaMock.order.findMany).not.toHaveBeenCalled()
  })

  it('queries cancelled unpaid-flagged orders with no active refund', async () => {
    await GET(buildRequest())

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'CANCELLED',
          paymentStatus: 'PAID',
          deletedAt: null,
          refunds: {
            none: { status: { in: ['PENDING', 'PROCESSING', 'PROCESSED'] } },
          },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        skip: 0,
      })
    )
  })

  it('returns the documented item fields and nothing personal', async () => {
    prismaMock.order.findMany.mockResolvedValue([buildOrder()])

    const response = await GET(buildRequest())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(Object.keys(body.items[0]).sort()).toEqual(ITEM_KEYS)
    const serialized = JSON.stringify(body).toLowerCase()
    for (const forbidden of ['customeremail', 'customerphone', 'customeraddress', 'paystackref', 'reference', 'user@']) {
      expect(serialized).not.toContain(forbidden)
    }
    expect(body.items[0]).toMatchObject({
      orderId: 'order_1',
      orderRef: '#ORDER_1',
      requestSource: 'NONE_RECORDED',
      total: 120,
      currency: 'GHS',
      walletAssisted: false,
      orderType: 'NORMAL',
      storeName: 'Fake Store',
      refundStatus: null,
    })
  })

  it('flags wallet-assisted orders', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({ walletAmountApplied: 25.5 }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items[0].walletAssisted).toBe(true)
  })

  it('derives CUSTOMER_CANCEL from the latest refund-request audit log', async () => {
    prismaMock.order.findMany.mockResolvedValue([buildOrder()])
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        entityId: 'order_1',
        createdAt: new Date('2026-10-01T01:00:00.000Z'),
        afterData: { source: 'CUSTOMER_CANCEL', walletAssisted: false },
      },
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items[0].requestSource).toBe('CUSTOMER_CANCEL')
  })

  it('derives VENDOR_REJECTION from the audit log', async () => {
    prismaMock.order.findMany.mockResolvedValue([buildOrder()])
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        entityId: 'order_1',
        createdAt: new Date('2026-10-01T01:00:00.000Z'),
        afterData: { source: 'VENDOR_REJECTION' },
      },
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items[0].requestSource).toBe('VENDOR_REJECTION')
  })

  it('marks an order with no recorded request as NONE_RECORDED', async () => {
    prismaMock.order.findMany.mockResolvedValue([buildOrder()])
    prismaMock.auditLog.findMany.mockResolvedValue([])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items[0].requestSource).toBe('NONE_RECORDED')
  })

  it('keeps orders whose only refund rows failed, with the state visible', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({
        refunds: [{ status: 'FAILED', createdAt: new Date('2026-10-02T00:00:00.000Z') }],
      }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].refundStatus).toBe('FAILED')
  })

  it('uses the latest CANCELLED fulfillment event as cancelledAt', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({ updatedAt: new Date('2026-10-05T00:00:00.000Z') }),
    ])
    prismaMock.fulfillmentEvent.findMany.mockResolvedValue([
      { orderId: 'order_1', createdAt: new Date('2026-10-01T00:00:00.000Z') },
      { orderId: 'order_1', createdAt: new Date('2026-09-30T00:00:00.000Z') },
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items[0].cancelledAt).toBe('2026-10-01T00:00:00.000Z')
    expect(body.items[0].ageDays).toBeGreaterThanOrEqual(0)
  })

  it('falls back to updatedAt when there is no CANCELLED event', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({ updatedAt: new Date('2026-10-01T00:00:00.000Z') }),
    ])
    prismaMock.fulfillmentEvent.findMany.mockResolvedValue([])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items[0].cancelledAt).toBe('2026-10-01T00:00:00.000Z')
  })

  it('clamps the page size and validates the pagination params', async () => {
    prismaMock.order.findMany.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => buildOrder({ id: `order_${index}` }))
    )

    const clamped = await GET(buildRequest('http://localhost/api/admin/refund-requests?limit=500'))
    const clampedBody = await clamped.json()
    expect(clampedBody.pagination).toEqual({ page: 1, limit: 100, hasMore: true })
    expect(clampedBody.items).toHaveLength(100)
    expect(prismaMock.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 101 })
    )

    const badLimit = await GET(buildRequest('http://localhost/api/admin/refund-requests?limit=abc'))
    expect(badLimit.status).toBe(400)

    const badPage = await GET(buildRequest('http://localhost/api/admin/refund-requests?page=0'))
    expect(badPage.status).toBe(400)
  })

  it('pages with skip', async () => {
    await GET(buildRequest('http://localhost/api/admin/refund-requests?page=3&limit=10'))

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 11 })
    )
  })

  it('returns 500 when the queue query fails', async () => {
    prismaMock.order.findMany.mockRejectedValue(new Error('db down'))

    const response = await GET(buildRequest())

    expect(response.status).toBe(500)
  })
})
