import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { findMany: vi.fn(), count: vi.fn() },
  productCategory: { findUnique: vi.fn() },
  brand: { findUnique: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const getCategoryFilterIdsMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/categories', () => ({ getCategoryFilterIds: getCategoryFilterIdsMock }))

import { GET } from '@/app/api/products/route'

const VENDOR = { authenticated: true, userId: 'vendor_1', role: 'VENDOR', sessionId: 's' }

function buildRequest(url: string, withToken = false): NextRequest {
  return new NextRequest(url, {
    headers: withToken ? { cookie: 'token=test-token' } : {},
  })
}

function mockAuth(authenticated = false, role = 'VENDOR') {
  verifyTokenMock.mockResolvedValue(
    authenticated ? { authenticated: true, userId: 'vendor_1', role, sessionId: 's' } : { authenticated: false, reason: 'invalid' }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth(false)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store_1', userId: 'vendor_1' })
  prismaMock.product.findMany.mockResolvedValue([])
  prismaMock.product.count.mockResolvedValue(0)
})

describe('GET /api/products search scoping', () => {
  it('vendor-scoped: applies search param to vendorWhere', async () => {
    mockAuth(true, 'VENDOR')
    const res = await GET(buildRequest('http://localhost/api/products?search=widget', true))
    expect(res.status).toBe(200)
    const call = prismaMock.product.findMany.mock.calls[0]?.[0]
    expect(call.where).toMatchObject({ storeId: 'store_1', name: { contains: 'widget', mode: 'insensitive' } })
    expect(call.select.variants).toBeDefined()
  })

  it('vendor-scoped: applies availabilityType param', async () => {
    mockAuth(true, 'VENDOR')
    await GET(buildRequest('http://localhost/api/products?availabilityType=PREORDER', true))
    const call = prismaMock.product.findMany.mock.calls[0]?.[0]
    expect(call.where).toMatchObject({ storeId: 'store_1', availabilityType: 'PREORDER' })
  })

  it('guest: ignores search param (no name filter) and exposes no variants', async () => {
    mockAuth(false)
    prismaMock.product.findMany.mockResolvedValue([])
    prismaMock.product.count.mockResolvedValue(0)
    await GET(buildRequest('http://localhost/api/products?search=widget'))
    const call = prismaMock.product.findMany.mock.calls[0]?.[0]
    expect(call.where?.name).toBeUndefined()
    expect(call.select?.variants).toBeUndefined()
  })

  it('guest: response products have no variants field', async () => {
    mockAuth(false)
    prismaMock.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Widget', stock: 5, reservedQuantity: 0, availabilityType: 'IN_STOCK' }])
    prismaMock.product.count.mockResolvedValue(1)
    const res = await GET(buildRequest('http://localhost/api/products'))
    const body = await res.json()
    expect(body.products[0].variants).toBeUndefined()
  })
})
