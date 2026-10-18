import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findMany: vi.fn(), count: vi.fn() },
  orderItem: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET } from '@/app/api/vendor/orders/route'

const VENDOR = { authenticated: true, userId: 'vendor_1', role: 'VENDOR', sessionId: 's' }

function buildRequest(url: string, withToken = true): NextRequest {
  return new NextRequest(url, { headers: withToken ? { cookie: 'token=test-token' } : {} })
}

function mockAuth(authenticated = true) {
  verifyTokenMock.mockResolvedValue(authenticated ? VENDOR : { authenticated: false, reason: 'invalid' })
}

function mockStore(value: any = { id: 'store_1', userId: 'vendor_1', products: [{ id: 'prod_a' }] }) {
  prismaMock.store.findUnique.mockResolvedValue(value)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth()
  isVendorOnboardedMock.mockResolvedValue(true)
  mockStore()
  prismaMock.order.findMany.mockResolvedValue([])
  prismaMock.order.count.mockResolvedValue(0)
  prismaMock.orderItem.findMany.mockResolvedValue([])
})

describe('GET /api/vendor/orders', () => {
  it('source=MANUAL filters to manual rows', async () => {
    const res = await GET(buildRequest('http://localhost/api/vendor/orders?source=MANUAL'))
    expect(res.status).toBe(200)
    const where = prismaMock.order.findMany.mock.calls[0]?.[0].where
    expect(where.source).toBe('MANUAL')
  })

  it('source=ONLINE filters to online rows', async () => {
    await GET(buildRequest('http://localhost/api/vendor/orders?source=ONLINE'))
    const where = prismaMock.order.findMany.mock.calls[0]?.[0].where
    expect(where.source).toBe('ONLINE')
  })

  it('unpaid=true sets paymentStatus not PAID', async () => {
    await GET(buildRequest('http://localhost/api/vendor/orders?unpaid=true'))
    const where = prismaMock.order.findMany.mock.calls[0]?.[0].where
    expect(where.paymentStatus).toEqual({ not: 'PAID' })
  })

  it('unpaid never returns ONLINE PENDING: base OR + not PAID excludes online pending', async () => {
    await GET(buildRequest('http://localhost/api/vendor/orders?unpaid=true'))
    const where = prismaMock.order.findMany.mock.calls[0]?.[0].where
    // base OR still present
    expect(where.OR).toEqual([{ paymentStatus: 'PAID' }, { source: 'MANUAL' }])
    expect(where.paymentStatus).toEqual({ not: 'PAID' })
  })

  it('MANUAL-only fields absent on ONLINE rows', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'ord_online', source: 'ONLINE', status: 'PROCESSING', paymentStatus: 'PAID',
        items: [{ price: 10, quantity: 1, product: { id: 'prod_a', name: 'P', availabilityType: 'IN_STOCK' } }],
        user: { email: 'a@b.com', profile: { firstName: 'A', lastName: 'B' } },
        payment: null,
        customerFirstName: null, customerLastName: null, customerPhone: null,
        paymentMethod: null, receiptToken: null, channel: 'ONLINE',
      },
    ])
    prismaMock.order.count.mockResolvedValue(1)
    const res = await GET(buildRequest('http://localhost/api/vendor/orders'))
    const body = await res.json()
    const row = body.orders[0]
    expect(row.source).toBe('ONLINE')
    expect(row.displayNumber).toBeUndefined()
    expect(row.customerName).toBeUndefined()
    expect(row.customerPhone).toBeUndefined()
    expect(row.receiptToken).toBeUndefined()
    expect(row.receiptUrl).toBeUndefined()
  })

  it('vendor A never sees vendor B manual orders: query scoped to store products', async () => {
    await GET(buildRequest('http://localhost/api/vendor/orders'))
    const where = prismaMock.order.findMany.mock.calls[0]?.[0].where
    expect(where.items).toEqual({ some: { productId: { in: ['prod_a'] } } })
  })
})
