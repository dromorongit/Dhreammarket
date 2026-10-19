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
    payment: { currency: 'GHS', amount: 120 },
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
  'refundedPesewas',
  'paymentPesewas',
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
          source: { not: 'MANUAL' },
          refunds: {
            none: { status: { in: ['PENDING', 'PROCESSING', 'PROCESSED'] } },
          },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 500,
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

  it('keeps an order visible until its PROCESSED refunds cover the payment', async () => {
    // Partly refunded: 40 of 120 charged has gone back. The order stays in
    // the queue, because the decision on the remaining 80 is still pending.
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({
        refunds: [
          { status: 'PROCESSED', amount: 40, createdAt: new Date('2026-10-02T00:00:00.000Z') },
        ],
      }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].refundedPesewas).toBe(4000)
    expect(body.items[0].paymentPesewas).toBe(12000)
  })

  it('hides an order whose PROCESSED refunds cover the payment', async () => {
    // This is the S1b rule: once the refunded amount covers the payment, the
    // order is no longer waiting for a decision.
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({
        refunds: [
          { status: 'PROCESSED', amount: 60, createdAt: new Date('2026-10-02T00:00:00.000Z') },
          { status: 'PROCESSED', amount: 60, createdAt: new Date('2026-10-03T00:00:00.000Z') },
        ],
      }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items).toHaveLength(0)
  })

  it('decides the cover in integer pesewas, so one pesewa short is still visible', async () => {
    // 120.00 charged, 119.99 refunded: a single pesewa gap must not be lost.
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({
        refunds: [
          { status: 'PROCESSED', amount: 119.99, createdAt: new Date('2026-10-02T00:00:00.000Z') },
        ],
      }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].refundedPesewas).toBe(11999)
    expect(body.items[0].paymentPesewas).toBe(12000)
  })

  it('does not count FAILED refunds towards the cover', async () => {
    // A FAILED row never moved money, so it cannot reduce what is still owed.
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({
        refunds: [
          { status: 'FAILED', amount: 120, createdAt: new Date('2026-10-02T00:00:00.000Z') },
        ],
      }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].refundedPesewas).toBe(0)
    expect(body.items[0].refundStatus).toBe('FAILED')
  })

  it('does not count PENDING refunds towards the cover either', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({
        refunds: [
          { status: 'PENDING', amount: 120, createdAt: new Date('2026-10-02T00:00:00.000Z') },
        ],
      }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].refundedPesewas).toBe(0)
  })

  it('sums only PROCESSED rows across several refunds', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      buildOrder({
        refunds: [
          { status: 'PROCESSED', amount: 10, createdAt: new Date('2026-10-02T00:00:00.000Z') },
          { status: 'FAILED', amount: 200, createdAt: new Date('2026-10-02T00:00:00.000Z') },
          { status: 'PROCESSED', amount: 20.5, createdAt: new Date('2026-10-03T00:00:00.000Z') },
        ],
      }),
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.items[0].refundedPesewas).toBe(3050)
  })

  it('clamps the page size and validates the pagination params', async () => {
    prismaMock.order.findMany.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => buildOrder({ id: `order_${index}` }))
    )

    const clamped = await GET(buildRequest('http://localhost/api/admin/refund-requests?limit=500'))
    const clampedBody = await clamped.json()
    expect(clampedBody.pagination).toEqual({ page: 1, limit: 100, hasMore: true, truncated: false })
    expect(clampedBody.items).toHaveLength(100)
    // We now fetch all candidates (capped at 500) and paginate in memory.
    expect(prismaMock.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 500 })
    )

    const badLimit = await GET(buildRequest('http://localhost/api/admin/refund-requests?limit=abc'))
    expect(badLimit.status).toBe(400)

    const badPage = await GET(buildRequest('http://localhost/api/admin/refund-requests?page=0'))
    expect(badPage.status).toBe(400)
  })

  it('fetches all candidates (capped at 500) and paginates in memory', async () => {
    await GET(buildRequest('http://localhost/api/admin/refund-requests?page=3&limit=10'))

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    )
    // No skip/take at DB level - pagination happens in memory after filtering.
  })

  it('returns truncated=true and notice when more than 500 candidates', async () => {
    prismaMock.order.findMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, index) => buildOrder({ id: `order_${index}` }))
    )

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.pagination.truncated).toBe(true)
    expect(body.notice).toBeDefined()
    expect(body.notice).toContain('500')
    expect(body.items).toHaveLength(25) // default page size
  })

  it('returns truncated=false when candidates are fewer than 500', async () => {
    prismaMock.order.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => buildOrder({ id: `order_${index}` }))
    )

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(body.pagination.truncated).toBe(false)
    expect(body.notice).toBeUndefined()
  })

  it('returns 500 when the queue query fails', async () => {
    prismaMock.order.findMany.mockRejectedValue(new Error('db down'))

    const response = await GET(buildRequest())

    expect(response.status).toBe(500)
  })
})
