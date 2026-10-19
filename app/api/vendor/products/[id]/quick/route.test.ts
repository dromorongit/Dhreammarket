import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { findUnique: vi.fn(), update: vi.fn() },
  productVariant: { update: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: createAuditLogMock }))

import { PATCH } from '@/app/api/vendor/products/[id]/quick/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

function buildRequest(body: unknown, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/products/prod_1/quick', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR)
  isVendorOnboardedMock.mockResolvedValue(true)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store_1', userId: 'vendor_1' })
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod_1',
    storeId: 'store_1',
    name: 'Widget',
    price: 20,
    salesPrice: null,
    stock: 5,
    reservedQuantity: 0,
    costPrice: null,
    variants: [{ id: 'var_1', costPrice: null }],
  })
  prismaMock.product.update.mockResolvedValue({
    id: 'prod_1',
    price: 20,
    salesPrice: null,
    stock: 5,
    costPrice: 8,
  })
  prismaMock.productVariant.update.mockResolvedValue({ id: 'var_1', costPrice: 6 })
})

describe('PATCH /api/vendor/products/[id]/quick cost prices', () => {
  it('returns 401 when no token cookie is present', async () => {
    const response = await PATCH(buildRequest({ costPrice: 8 }, false), {
      params: { id: 'prod_1' },
    })
    expect(response.status).toBe(401)
  })

  it('returns 403 when the caller is not a vendor', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'u1', role: 'CUSTOMER', sessionId: 's' })
    const response = await PATCH(buildRequest({ costPrice: 8 }), { params: { id: 'prod_1' } })
    expect(response.status).toBe(403)
  })

  it('returns 403 for a product in another store', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'prod_1',
      storeId: 'store_2',
      name: 'Widget',
      price: 20,
      salesPrice: null,
      stock: 5,
      reservedQuantity: 0,
      costPrice: null,
      variants: [],
    })
    const response = await PATCH(buildRequest({ costPrice: 8 }), { params: { id: 'prod_1' } })
    expect(response.status).toBe(403)
    expect(prismaMock.product.update).not.toHaveBeenCalled()
  })

  it('saves the product cost price', async () => {
    const response = await PATCH(buildRequest({ costPrice: 8 }), { params: { id: 'prod_1' } })
    expect(response.status).toBe(200)

    const update = prismaMock.product.update.mock.calls[0][0] as any
    expect(update.data.costPrice).toBe(8)
    const body = await response.json()
    expect(body.product.costPrice).toBe(8)
  })

  it('clears the product cost price when null is sent', async () => {
    const response = await PATCH(buildRequest({ costPrice: null }), { params: { id: 'prod_1' } })
    expect(response.status).toBe(200)
    const update = prismaMock.product.update.mock.calls[0][0] as any
    expect(update.data.costPrice).toBeNull()
  })

  it('saves variant cost prices', async () => {
    const response = await PATCH(
      buildRequest({ variantCosts: [{ id: 'var_1', costPrice: 6 }] }),
      { params: { id: 'prod_1' } }
    )
    expect(response.status).toBe(200)

    const update = prismaMock.productVariant.update.mock.calls[0][0] as any
    expect(update.where.id).toBe('var_1')
    expect(update.data.costPrice).toBe(6)
  })

  it('refuses a variant that belongs to another product', async () => {
    const response = await PATCH(
      buildRequest({ variantCosts: [{ id: 'var_other', costPrice: 6 }] }),
      { params: { id: 'prod_1' } }
    )
    expect(response.status).toBe(400)
    expect(prismaMock.productVariant.update).not.toHaveBeenCalled()
  })

  it('rejects a negative cost price', async () => {
    const response = await PATCH(buildRequest({ costPrice: -1 }), { params: { id: 'prod_1' } })
    expect(response.status).toBe(400)
  })

  it('rejects a cost price with more than two decimals', async () => {
    const response = await PATCH(buildRequest({ costPrice: 1.234 }), { params: { id: 'prod_1' } })
    expect(response.status).toBe(400)
  })

  it('still refuses to quick-edit the price of a product with variants', async () => {
    const response = await PATCH(buildRequest({ price: 25 }), { params: { id: 'prod_1' } })
    expect(response.status).toBe(409)
  })
})
