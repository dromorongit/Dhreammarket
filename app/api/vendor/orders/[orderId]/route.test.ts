import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findFirst: vi.fn() },
  orderItem: { count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET } from '@/app/api/vendor/orders/[orderId]/route'

const VENDOR_A = {
  authenticated: true,
  userId: 'vendor_a',
  role: 'VENDOR',
  sessionId: 'sess_a',
}

const VENDOR_B = {
  authenticated: true,
  userId: 'vendor_b',
  role: 'VENDOR',
  sessionId: 'sess_b',
}

const PARAMS = { params: { orderId: 'order_1' } }

function buildRequest(withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/orders/order_1', {
    method: 'GET',
    headers: {
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
  })
}

function mockAuth(outcome: any = VENDOR_A) {
  verifyTokenMock.mockResolvedValue(outcome)
}

function mockOnboarded(value = true) {
  isVendorOnboardedMock.mockResolvedValue(value)
}

function mockStore(value: any) {
  prismaMock.store.findUnique.mockResolvedValue(value)
}

function mockOrder(order: any) {
  prismaMock.order.findFirst.mockResolvedValue(order)
}

function earningsItem(productId: string, overrides: any = {}) {
  return {
    id: `item_${productId}`,
    productId,
    price: 10,
    quantity: 1,
    grossAmount: 10,
    processorFee: 0.2,
    netAmount: 9.8,
    platformCommission: 0,
    commissionRate: 0,
    vendorEarnings: 9.8,
    product: { id: productId, name: `Product ${productId}`, storeId: 'store_a' },
    ...overrides,
  }
}

function baseOrder(items: any[], overrides: any = {}) {
  return {
    id: 'order_1',
    deletedAt: null,
    paymentStatus: 'PAID',
    source: 'ONLINE',
    status: 'PROCESSING',
    deliveryCost: null,
    receiptToken: 'tok_1',
    channel: 'ONLINE',
    vendorAccepted: true,
    vendorRejected: false,
    vendorRejectionReason: null,
    payment: {
      id: 'pay_1',
      amount: 10,
      currency: 'GHS',
      status: 'PAID',
      reference: 'REF-1',
      paystackRef: 'PL-1',
      message: null,
      authorizationUrl: null,
      createdAt: new Date(),
    },
    items,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth(VENDOR_A)
  mockOnboarded(true)
  prismaMock.orderItem.count.mockResolvedValue(0)
})

describe('GET /api/vendor/orders/[orderId]', () => {
  it('vendor A sees earnings fields for their own order items', async () => {
    mockStore({ id: 'store_a', userId: 'vendor_a', name: 'Store A', products: [{ id: 'prod_a1' }] })
    mockOrder(baseOrder([earningsItem('prod_a1')]))

    const res = await GET(buildRequest(), PARAMS)
    expect(res.status).toBe(200)
    const json = await res.json()
    const item = json.order.items[0]
    expect(item.grossAmount).toBe(10)
    expect(item.processorFee).toBe(0.2)
    expect(item.netAmount).toBe(9.8)
    expect(item.platformCommission).toBe(0)
    expect(item.commissionRate).toBe(0)
    expect(item.vendorEarnings).toBe(9.8)
  })

  it("vendor B gets 404 for vendor A's order and receives no earnings data", async () => {
    mockAuth(VENDOR_B)
    mockStore({ id: 'store_b', userId: 'vendor_b', name: 'Store B', products: [{ id: 'prod_b1' }] })
    mockOrder(null)

    const res = await GET(buildRequest(), PARAMS)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Order not found or access denied')
    expect(json.order).toBeUndefined()

    const findFirstArgs = prismaMock.order.findFirst.mock.calls[0][0]
    expect(findFirstArgs.where.items.some.productId.in).toEqual(['prod_b1'])
  })

  it("in a multi-vendor order, the response includes earnings only for the requesting vendor's items", async () => {
    mockAuth(VENDOR_A)
    mockStore({ id: 'store_a', userId: 'vendor_a', name: 'Store A', products: [{ id: 'prod_a1' }] })

    const itemA = earningsItem('prod_a1')
    const itemB = earningsItem('prod_b1', {
      grossAmount: 99999,
      processorFee: 1949.8,
      netAmount: 98049.2,
      vendorEarnings: 98049.2,
      product: { id: 'prod_b1', name: 'Secret B Product', storeId: 'store_b' },
    })

    prismaMock.order.findFirst.mockImplementation(async (args: any) => {
      const scoped = args?.select?.items?.where?.productId?.in
      const items = scoped ? [itemA, itemB].filter((i) => scoped.includes(i.productId)) : [itemA, itemB]
      return baseOrder(items)
    })
    prismaMock.orderItem.count.mockResolvedValue(1)

    const res = await GET(buildRequest(), PARAMS)
    expect(res.status).toBe(200)
    const json = await res.json()
    const body = JSON.stringify(json)

    expect(json.order.items).toHaveLength(1)
    expect(json.order.items[0].productId).toBe('prod_a1')
    expect(json.order.items[0].grossAmount).toBe(10)

    expect(body).not.toContain('99999')
    expect(body).not.toContain('98049')
    expect(body).not.toContain('Secret B Product')
    expect(body).not.toContain('prod_b1')

    const findFirstArgs = prismaMock.order.findFirst.mock.calls[0][0]
    expect(findFirstArgs.select.items.where.productId.in).toEqual(['prod_a1'])
  })

  it('unauthenticated request is rejected', async () => {
    const res = await GET(buildRequest(false), PARAMS)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
    expect(verifyTokenMock).not.toHaveBeenCalled()
  })

  it('non-vendor role is rejected', async () => {
    mockAuth({ authenticated: true, userId: 'cust_1', role: 'CUSTOMER', sessionId: 'sess_c' })
    mockOnboarded(false)

    const res = await GET(buildRequest(), PARAMS)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Complete store setup to view order details')
    expect(json.order).toBeUndefined()
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
  })
})