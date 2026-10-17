import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  vendorCustomer: { findMany: vi.fn(), count: vi.fn() },
  order: { groupBy: vi.fn(), findMany: vi.fn() },
  orderItem: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET } from '@/app/api/vendor/customers/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

function buildRequest(search = ''): NextRequest {
  return new NextRequest(`http://localhost/api/vendor/customers?${search}`, {
    headers: { cookie: 'token=test-token' },
  })
}

function mockAuth(authenticated = true) {
  verifyTokenMock.mockResolvedValue(
    authenticated
      ? VENDOR
      : { authenticated: false, reason: 'invalid_token' }
  )
}

function mockOnboarded(value = true) {
  isVendorOnboardedMock.mockResolvedValue(value)
}

function mockStore(value: any = { id: 'store_1', userId: 'vendor_1', name: 'Fake Store' }) {
  prismaMock.store.findUnique.mockResolvedValue(value)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth()
  mockOnboarded()
  mockStore()
})

const customers = [
  {
    id: 'vc_1',
    name: 'Ada Lovelace',
    phone: '+233242222222',
    email: 'ada@example.com',
    tags: ['wholesale'],
    notes: null,
    firstChannel: 'WHATSAPP',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-03T00:00:00.000Z'),
  },
]

describe('GET /api/vendor/customers', () => {
  it('returns 401 without a token', async () => {
    const response = await GET(new NextRequest('http://localhost/api/vendor/customers'))
    expect(response.status).toBe(401)
  })

  it('returns 403 when the token is invalid', async () => {
    mockAuth(false)
    const response = await GET(buildRequest())
    expect(response.status).toBe(403)
  })

  it('returns 403 when not onboarded', async () => {
    mockOnboarded(false)
    const response = await GET(buildRequest())
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    mockStore(null)
    const response = await GET(buildRequest())
    expect(response.status).toBe(404)
  })

  it('returns paginated customers scoped to the store', async () => {
    prismaMock.vendorCustomer.findMany.mockResolvedValue(customers)
    prismaMock.vendorCustomer.count.mockResolvedValue(1)
    prismaMock.order.groupBy
      .mockResolvedValueOnce([
        { vendorCustomerId: 'vc_1', _count: { id: 3 }, _max: { createdAt: new Date('2026-01-05T00:00:00.000Z') } },
      ])
      .mockResolvedValueOnce([{ vendorCustomerId: 'vc_1', _sum: { total: 150.75 } }])
    prismaMock.order.findMany.mockResolvedValue([{ id: 'ord_1', vendorCustomerId: 'vc_1' }])
    prismaMock.orderItem.findMany.mockResolvedValue([
      { orderId: 'ord_1', product: { id: 'p1', name: 'Thing' }, quantity: 2, price: 10 },
    ])

    const response = await GET(buildRequest('page=1&limit=10'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 })

    expect(prismaMock.vendorCustomer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store_1' }, skip: 0, take: 10 })
    )

    const customer = body.customers[0]
    expect(customer.id).toBe('vc_1')
    expect(customer.orderCount).toBe(3)
    expect(customer.totalSpent).toBe(150.75)
    expect(customer.lastOrderAt).toBe('2026-01-05T00:00:00.000Z')
    expect(customer.lastOrderedItems).toEqual([
      { productId: 'p1', productName: 'Thing', quantity: 2, unitPrice: 10 },
    ])
  })

  it('applies search across name, phone and email', async () => {
    prismaMock.vendorCustomer.findMany.mockResolvedValue([])
    prismaMock.vendorCustomer.count.mockResolvedValue(0)
    prismaMock.order.groupBy.mockResolvedValue([])

    await GET(buildRequest('search=ada'))
    expect(prismaMock.vendorCustomer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: 'store_1',
          OR: expect.arrayContaining([
            { name: { contains: 'ada', mode: 'insensitive' } },
            { phone: { contains: 'ada', mode: 'insensitive' } },
            { email: { contains: 'ada', mode: 'insensitive' } },
          ]),
        }),
      })
    )
  })

  it('excludes other stores’ customers (IDOR)', async () => {
    prismaMock.vendorCustomer.findMany.mockResolvedValue([])
    prismaMock.vendorCustomer.count.mockResolvedValue(0)
    prismaMock.order.groupBy.mockResolvedValue([])

    await GET(buildRequest())
    const where = prismaMock.vendorCustomer.findMany.mock.calls[0]?.[0]?.where
    expect(where.storeId).toBe('store_1')
  })
})
