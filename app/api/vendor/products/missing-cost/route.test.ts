import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET } from '@/app/api/vendor/products/missing-cost/route'

const VENDOR_A = {
  authenticated: true,
  userId: 'vendor_a',
  role: 'VENDOR',
  sessionId: 'sess_a',
}

const PRODUCT_STORE: Record<string, string> = {
  prod_a1: 'store_a',
  prod_a2: 'store_a',
  prod_b1: 'store_b',
}

const PRODUCTS = [
  {
    id: 'prod_a1',
    name: 'Vendor A Widget',
    price: 20,
    costPrice: null,
    variants: [
      { id: 'var_a1', color: 'Red', size: null, age: null, sku: null, price: 20, costPrice: null },
    ],
  },
  {
    id: 'prod_a2',
    name: 'Vendor A Gadget',
    price: 30,
    costPrice: 10,
    variants: [],
  },
  {
    id: 'prod_b1',
    name: 'Vendor B Thing',
    price: 80,
    costPrice: null,
    variants: [],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR_A)
  isVendorOnboardedMock.mockResolvedValue(true)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store_a', userId: 'vendor_a' })
  prismaMock.product.findMany.mockImplementation(async ({ where }: any) =>
    PRODUCTS.filter((p) => PRODUCT_STORE[p.id] === where.storeId).map((p) => ({
      ...p,
      storeId: PRODUCT_STORE[p.id],
    })),
  )
})

function buildRequest(query = '', withToken = true): NextRequest {
  return new NextRequest(`http://localhost/api/vendor/products/missing-cost?${query}`, {
    method: 'GET',
    headers: withToken ? { cookie: 'token=test-token' } : {},
  })
}

describe('GET /api/vendor/products/missing-cost', () => {
  it('returns 401 when no token cookie is present', async () => {
    const response = await GET(buildRequest('', false))
    expect(response.status).toBe(401)
  })

  it('returns 403 when the token is not authenticated', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: false, reason: 'invalid_token' })
    const response = await GET(buildRequest())
    expect(response.status).toBe(401)
  })

  it('returns 403 when the caller is not a vendor', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'u1', role: 'CUSTOMER', sessionId: 's' })
    const response = await GET(buildRequest())
    expect(response.status).toBe(403)
  })

  it('returns 403 when the vendor is not onboarded', async () => {
    isVendorOnboardedMock.mockResolvedValue(false)
    const response = await GET(buildRequest())
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    prismaMock.store.findUnique.mockResolvedValue(null)
    const response = await GET(buildRequest())
    expect(response.status).toBe(400)
  })

  it('lists only the products that still need a cost', async () => {
    const response = await GET(buildRequest())
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].productId).toBe('prod_a1')
    expect(body.items[0].productVariantId).toBe('var_a1')
    expect(body.items[0].variantLabel).toBe('Red')
    expect(body.items[0].price).toBe(20)
  })

  it('reports how much of the catalogue has a cost', async () => {
    const response = await GET(buildRequest())
    const body = await response.json()

    // prod_a1 has one variant slot with no cost, prod_a2 has a product cost.
    expect(body.progress.total).toBe(2)
    expect(body.progress.withCost).toBe(1)
    expect(body.progress.missing).toBe(1)
    expect(body.progress.percent).toBe(50)
  })

  it('never shows another vendor\'s products', async () => {
    const response = await GET(buildRequest())
    const body = await response.json()
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store_a' } })
    )
    expect(JSON.stringify(body)).not.toContain('Vendor B Thing')
  })

  it('pages the list', async () => {
    prismaMock.product.findMany.mockImplementation(async ({ where }: any) =>
      Array.from({ length: 30 }, (_, index) => ({
        id: `prod_a_${index}`,
        name: `Widget ${index}`,
        price: 20,
        costPrice: null,
        variants: [],
        storeId: where.storeId,
      })),
    )

    const first = await (await GET(buildRequest('page=1&limit=10'))).json()
    expect(first.items).toHaveLength(10)
    expect(first.pagination).toEqual({ page: 1, limit: 10, total: 30, totalPages: 3 })

    const last = await (await GET(buildRequest('page=3&limit=10'))).json()
    expect(last.items).toHaveLength(10)
    expect(last.pagination.page).toBe(3)
  })
})
