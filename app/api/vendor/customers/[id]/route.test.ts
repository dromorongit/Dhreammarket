import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  vendorCustomer: { findFirst: vi.fn(), update: vi.fn() },
  order: { groupBy: vi.fn(), findFirst: vi.fn() },
  orderItem: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET, PATCH } from '@/app/api/vendor/customers/[id]/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

const PARAMS = { params: { id: 'vc_1' } }

function buildRequest(url: string, body?: unknown, withToken = true): NextRequest {
  const init: any = {
    method: body === undefined ? 'GET' : 'PATCH',
    headers: {
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
  }
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
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
  prismaMock.vendorCustomer.findFirst.mockResolvedValue({
    id: 'vc_1',
    storeId: 'store_1',
    name: 'Ada',
    phone: '+233242222222',
    email: 'ada@example.com',
    tags: [],
    notes: null,
    firstChannel: 'WHATSAPP',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-03T00:00:00.000Z'),
  })
  prismaMock.order.groupBy
    .mockResolvedValueOnce([{ vendorCustomerId: 'vc_1', _count: { id: 2 }, _max: { createdAt: new Date('2026-01-05T00:00:00.000Z') } }])
    .mockResolvedValueOnce([{ vendorCustomerId: 'vc_1', _sum: { total: 120 } }])
  prismaMock.order.findFirst.mockResolvedValue({ id: 'ord_1', vendorCustomerId: 'vc_1' })
  prismaMock.orderItem.findMany.mockResolvedValue([
    { product: { id: 'p1', name: 'Thing' }, quantity: 1, price: 120 },
  ])
})

describe('GET /api/vendor/customers/[id]', () => {
  it('returns 401 without a token', async () => {
    const response = await GET(buildRequest('http://localhost/api/vendor/customers/vc_1', undefined, false), PARAMS)
    expect(response.status).toBe(401)
  })

  it('returns 403 when not authenticated', async () => {
    mockAuth(false)
    const response = await GET(buildRequest('http://localhost/api/vendor/customers/vc_1'), PARAMS)
    expect(response.status).toBe(403)
  })

  it('returns 403 when not onboarded', async () => {
    mockOnboarded(false)
    const response = await GET(buildRequest('http://localhost/api/vendor/customers/vc_1'), PARAMS)
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    mockStore(null)
    const response = await GET(buildRequest('http://localhost/api/vendor/customers/vc_1'), PARAMS)
    expect(response.status).toBe(404)
  })

  it('returns 404 for another store’s customer (IDOR)', async () => {
    prismaMock.vendorCustomer.findFirst.mockResolvedValue(null)
    const response = await GET(buildRequest('http://localhost/api/vendor/customers/vc_1'), PARAMS)
    expect(response.status).toBe(404)
  })

  it('returns the customer with derived stats and last ordered items', async () => {
    const response = await GET(buildRequest('http://localhost/api/vendor/customers/vc_1'), PARAMS)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.customer.id).toBe('vc_1')
    expect(body.customer.name).toBe('Ada')
    expect(body.customer.orderCount).toBe(2)
    expect(body.customer.totalSpent).toBe(120)
    expect(body.customer.lastOrderAt).toBe('2026-01-05T00:00:00.000Z')
    expect(body.customer.lastOrderedItems).toEqual([
      { productId: 'p1', productName: 'Thing', quantity: 1, unitPrice: 120 },
    ])
    expect(prismaMock.vendorCustomer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'vc_1', storeId: 'store_1' } })
    )
  })
})

describe('PATCH /api/vendor/customers/[id]', () => {
  it('returns 401 without a token', async () => {
    const response = await PATCH(buildRequest('http://localhost/api/vendor/customers/vc_1', { name: 'Ada Updated' }, false), PARAMS)
    expect(response.status).toBe(401)
  })

  it('rejects phone changes', async () => {
    const response = await PATCH(
      buildRequest('http://localhost/api/vendor/customers/vc_1', { phone: '0540000000' }),
      PARAMS
    )
    expect(response.status).toBe(400)
    expect(prismaMock.vendorCustomer.update).not.toHaveBeenCalled()
  })

  it('updates name, email, tags and notes', async () => {
    prismaMock.vendorCustomer.update.mockResolvedValue({
      id: 'vc_1',
      storeId: 'store_1',
      name: 'Ada Updated',
      phone: '+233242222222',
      email: 'ada2@example.com',
      tags: ['vip'],
      notes: 'cash buyer',
      firstChannel: 'WHATSAPP',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-06T00:00:00.000Z'),
    })

    const response = await PATCH(
      buildRequest('http://localhost/api/vendor/customers/vc_1', {
        name: 'Ada Updated',
        email: 'ada2@example.com',
        tags: ['vip'],
        notes: 'cash buyer',
      }),
      PARAMS
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.customer.name).toBe('Ada Updated')
    expect(body.customer.email).toBe('ada2@example.com')
    expect(body.customer.tags).toEqual(['vip'])
    expect(body.customer.notes).toBe('cash buyer')
    expect(body.customer.phone).toBe('+233242222222')

    expect(prismaMock.vendorCustomer.update).toHaveBeenCalledWith({
      where: { id: 'vc_1' },
      data: {
        name: 'Ada Updated',
        email: 'ada2@example.com',
        tags: ['vip'],
        notes: 'cash buyer',
      },
      select: expect.any(Object),
    })
  })

  it('rejects invalid email', async () => {
    const response = await PATCH(
      buildRequest('http://localhost/api/vendor/customers/vc_1', { email: 'not-an-email' }),
      PARAMS
    )
    expect(response.status).toBe(400)
  })

  it('returns 404 for another store’s customer (IDOR)', async () => {
    prismaMock.vendorCustomer.findFirst.mockResolvedValue(null)
    const response = await PATCH(
      buildRequest('http://localhost/api/vendor/customers/vc_1', { name: 'Ada Updated' }),
      PARAMS
    )
    expect(response.status).toBe(404)
  })
})
