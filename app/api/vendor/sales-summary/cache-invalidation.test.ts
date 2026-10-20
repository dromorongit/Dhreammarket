// The cache of the money view must never show a number that is already
// wrong.
//
// The cache lives for 60 seconds, but a sale, a payment, a status change or
// a cost edit changes the numbers at once. Every one of those writes drops
// the entries of that store, so the next read recomputes them.
//
// What is checked here:
//   * a sale that is recorded right after a read shows up in the next read
//   * the entries of one vendor are never touched by the invalidation of
//     another vendor
//   * the key of one vendor never collides with the key of another vendor,
//     and the key of one source never collides with the key of another

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({}) as any)

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const rateLimitMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rate-limit', () => ({ rateLimit: rateLimitMock }))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: createAuditLogMock }))

const consumeManualSaleStockMock = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }))
vi.mock('@/lib/stock-reservation', () => ({
  consumeManualSaleStock: consumeManualSaleStockMock,
}))

import { GET as GET_SUMMARY } from '@/app/api/vendor/sales-summary/route'
import { POST as CREATE_MANUAL_ORDER } from '@/app/api/vendor/manual-orders/route'
import {
  clearSalesSummaryCache,
  getCachedSalesSummary,
  invalidateSalesSummaryCache,
  invalidateSalesSummaryCaches,
  salesSummaryCacheKey,
  setCachedSalesSummary,
} from '@/lib/sales-summary-cache'
import {
  createFakeSalesPrisma,
  type FakeOrder,
  type FakeProduct,
} from '@/app/api/vendor/sales-summary/fake-sales-db.test-utils'

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

const PRODUCTS: FakeProduct[] = [
  {
    id: 'prod_a',
    storeId: 'store_a',
    name: 'Vendor A Widget',
    price: 20,
    costPrice: 8,
    availabilityType: 'IN_STOCK',
    variants: [],
  },
]

let requestCounter = 0

function buildSummaryRequest(query = 'from=2026-10-01&to=2026-10-31'): NextRequest {
  requestCounter += 1
  return new NextRequest(`http://localhost/api/vendor/sales-summary?${query}`, {
    method: 'GET',
    headers: {
      cookie: 'token=test-token',
      'x-forwarded-for': `10.0.0.${requestCounter}`,
    },
  })
}

function buildManualOrderRequest(body: unknown): NextRequest {
  requestCounter += 1
  return new NextRequest('http://localhost/api/vendor/manual-orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'token=test-token',
      'x-forwarded-for': `10.0.0.${requestCounter}`,
    },
    body: JSON.stringify(body),
  })
}

function useFakeDb(orders: FakeOrder[] = []) {
  const fake = createFakeSalesPrisma({
    store: { id: 'store_a', userId: 'vendor_a' },
    products: PRODUCTS,
    orders,
    refunds: [],
  })

  Object.assign(prismaMock, fake)
  return fake
}

/**
 * Put an entry in the cache.
 *
 * The value does not matter here: what matters is that an entry exists for
 * the key and that the invalidation finds it.
 */
function primeCache(key: string): void {
  setCachedSalesSummary(key, { range: { from: '2026-10-01', to: '2026-10-31', days: 31 } } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  clearSalesSummaryCache()
  verifyTokenMock.mockResolvedValue(VENDOR_A)
  isVendorOnboardedMock.mockResolvedValue(true)
  rateLimitMock.mockReturnValue(() => ({ success: true }))
  useFakeDb()
})

afterEach(() => {
  clearSalesSummaryCache()
})

describe('the cache of the money view', () => {
  it('shows a sale that was recorded after the last read', async () => {
    // The vendor opens the money view. There is nothing yet.
    const first = await GET_SUMMARY(buildSummaryRequest())
    expect(first.status).toBe(200)
    const before = await first.json()
    expect(before.totals.revenue).toBe(0)

    // The second read is served from the cache.
    const second = await GET_SUMMARY(buildSummaryRequest())
    expect(second.status).toBe(200)
    const cached = await second.json()
    expect(cached.cached).toBe(true)

    // The vendor records a sale.
    const sale = await CREATE_MANUAL_ORDER(
      buildManualOrderRequest({
        customer: { name: 'Kofi Mensah', phone: '0242222222' },
        channel: 'WHATSAPP',
        items: [{ productId: 'prod_a', quantity: 2 }],
        deliveryFee: 0,
        markPaid: true,
        paymentMethod: 'CASH',
        idempotencyKey: 'key_1',
      })
    )
    expect(sale.status).toBe(201)

    // The next read is not served from the cache and holds the sale.
    const third = await GET_SUMMARY(buildSummaryRequest())
    expect(third.status).toBe(200)
    const after = await third.json()
    expect(after.cached).not.toBe(true)
    expect(after.totals.revenue).toBe(40)
    expect(after.totals.orders).toBe(1)
  })

  it('drops the entry of the store when a sale is recorded', async () => {
    const response = await GET_SUMMARY(buildSummaryRequest())
    expect(response.status).toBe(200)

    const key = salesSummaryCacheKey(
      'store_a',
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-10-31T00:00:00.000Z'),
      'ALL',
    )
    expect(getCachedSalesSummary(key)).not.toBeNull()

    await CREATE_MANUAL_ORDER(
      buildManualOrderRequest({
        customer: { name: 'Kofi Mensah', phone: '0242222222' },
        channel: 'WHATSAPP',
        items: [{ productId: 'prod_a', quantity: 1 }],
        deliveryFee: 0,
        markPaid: true,
        paymentMethod: 'CASH',
        idempotencyKey: 'key_2',
      })
    )

    expect(getCachedSalesSummary(key)).toBeNull()
  })

  it('never touches the entries of another vendor', () => {
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T00:00:00.000Z')

    const keyA = salesSummaryCacheKey('store_a', from, to, 'ALL')
    const keyB = salesSummaryCacheKey('store_b', from, to, 'ALL')
    const keyBOnline = salesSummaryCacheKey('store_b', from, to, 'ONLINE')

    primeCache(keyA)
    primeCache(keyB)
    primeCache(keyBOnline)

    const dropped = invalidateSalesSummaryCache('store_a')

    expect(dropped).toBe(1)
    expect(getCachedSalesSummary(keyA)).toBeNull()
    expect(getCachedSalesSummary(keyB)).not.toBeNull()
    expect(getCachedSalesSummary(keyBOnline)).not.toBeNull()
  })

  it('never drops the entries of a store whose name starts the same', () => {
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T00:00:00.000Z')

    const short = salesSummaryCacheKey('store_a', from, to, 'ALL')
    const longer = salesSummaryCacheKey('store_a_b', from, to, 'ALL')

    primeCache(short)
    primeCache(longer)

    invalidateSalesSummaryCache('store_a')

    expect(getCachedSalesSummary(short)).toBeNull()
    expect(getCachedSalesSummary(longer)).not.toBeNull()
  })

  it('drops the entries of several stores at once', () => {
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T00:00:00.000Z')

    const keyA = salesSummaryCacheKey('store_a', from, to, 'ALL')
    const keyB = salesSummaryCacheKey('store_b', from, to, 'ALL')

    primeCache(keyA)
    primeCache(keyB)

    expect(invalidateSalesSummaryCaches(['store_a', 'store_b', 'store_a'])).toBe(2)
    expect(getCachedSalesSummary(keyA)).toBeNull()
    expect(getCachedSalesSummary(keyB)).toBeNull()
  })

  it('never builds the same key for two vendors or two sources', () => {
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T00:00:00.000Z')

    const keys = new Set([
      salesSummaryCacheKey('store_a', from, to, 'ALL'),
      salesSummaryCacheKey('store_b', from, to, 'ALL'),
      salesSummaryCacheKey('store_a', from, to, 'ONLINE'),
      salesSummaryCacheKey('store_a', from, to, 'MANUAL'),
    ])

    expect(keys.size).toBe(4)
  })

  it('never builds the same key when a store id holds the separator', () => {
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T00:00:00.000Z')

    const odd = salesSummaryCacheKey('store|a', from, to, 'ALL')
    const plain = salesSummaryCacheKey('store', from, to, 'ALL')

    expect(odd).not.toBe(plain)

    primeCache(odd)
    primeCache(plain)

    invalidateSalesSummaryCache('store')

    expect(getCachedSalesSummary(odd)).not.toBeNull()
    expect(getCachedSalesSummary(plain)).toBeNull()
  })
})
