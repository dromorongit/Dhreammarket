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

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR)
  isVendorOnboardedMock.mockResolvedValue(true)
  prismaMock.store.findUnique.mockResolvedValue({
    id: 'store_1',
    userId: 'vendor_1',
    name: 'Fake Store',
  })
  prismaMock.vendorCustomer.findFirst.mockResolvedValue(null)
})

describe('vendor-customers lookup rate limit', () => {
  it('returns 429 on the 61st request in a minute', async () => {
    const { GET } = await import('@/app/api/vendor/customers/lookup/route')
    const headers = { cookie: 'token=test-token', 'x-forwarded-for': '198.51.100.51' }
    for (let i = 0; i < 60; i += 1) {
      const response = await GET(
        new NextRequest('http://localhost/api/vendor/customers/lookup?phone=0242222222', { headers })
      )
      expect(response.status).not.toBe(429)
    }
    const blocked = await GET(
      new NextRequest('http://localhost/api/vendor/customers/lookup?phone=0242222222', { headers })
    )
    expect(blocked.status).toBe(429)
  })
})
