import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  vendorCustomer: { findFirst: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET } from '@/app/api/vendor/customers/lookup/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

function buildRequest(search = ''): NextRequest {
  return new NextRequest(`http://localhost/api/vendor/customers/lookup?${search}`, {
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

describe('GET /api/vendor/customers/lookup', () => {
  it('returns 401 without a token', async () => {
    const response = await GET(new NextRequest('http://localhost/api/vendor/customers/lookup?phone=0242222222'))
    expect(response.status).toBe(401)
  })

  it('returns 403 when not authenticated or not onboarded', async () => {
    mockAuth(false)
    let response = await GET(buildRequest('phone=0242222222'))
    expect(response.status).toBe(403)
    mockAuth(true)
    mockOnboarded(false)
    response = await GET(buildRequest('phone=0242222222'))
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    mockStore(null)
    const response = await GET(buildRequest('phone=0242222222'))
    expect(response.status).toBe(404)
  })

  it('returns 400 when phone is missing or invalid', async () => {
    let response = await GET(buildRequest(''))
    expect(response.status).toBe(400)

    response = await GET(buildRequest('phone=123'))
    expect(response.status).toBe(400)
  })

  it('normalizes 024, 233 and +233 to the same customer', async () => {
    const customer = { id: 'vc_1', name: 'Ada', phone: '+233242222222', email: 'ada@example.com' }
    prismaMock.vendorCustomer.findFirst.mockResolvedValue(customer)

    const response = await GET(buildRequest('phone=0242222222'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.normalizedPhone).toBe('+233242222222')
    expect(body.found).toBe(true)
    expect(body.customer).toEqual(customer)
    expect(prismaMock.vendorCustomer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store_1', phone: '+233242222222' } })
    )

    prismaMock.vendorCustomer.findFirst.mockResolvedValue(customer)
    const response2 = await GET(buildRequest('phone=%2B233242222222'))
    expect(response2.status).toBe(200)
    expect((await response2.json()).found).toBe(true)
  })

  it('returns found false when no customer matches', async () => {
    prismaMock.vendorCustomer.findFirst.mockResolvedValue(null)
    const response = await GET(buildRequest('phone=0242222222'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.normalizedPhone).toBe('+233242222222')
    expect(body.found).toBe(false)
    expect(body.customer).toBe(null)
  })
})
