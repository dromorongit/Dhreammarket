import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/trust/cached-profile', () => ({
  getCachedSellerTrustProfile: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockGetCachedSellerTrustProfile = vi.mocked(getCachedSellerTrustProfile)

function buildMockPrisma() {
  const store = {
    id: 'store-1',
    slug: 'store-1',
    name: 'Store 1',
    categoryId: 'cat-1',
    isVerified: false,
    isFeatured: false,
    badgeTier: null,
    logo: null,
    banner: null,
    description: null,
    mainPhoneNumber: null,
    alternativePhoneNumber: null,
    whatsappNumber: null,
    location: null,
    createdAt: new Date('2024-01-01'),
    products: [],
    services: [],
    vendor_categories: { id: 'cat-1', name: 'Test', slug: 'test' },
    _count: { products: 0 },
  }
  const mockPrisma = {
    store: {
      findUnique: vi.fn(async () => store),
    },
    vendorFollow: {
      count: vi.fn(async () => 3),
    },
  }
  return { mockPrisma, store }
}

describe('Vendor trust API', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
    mockGetCachedSellerTrustProfile.mockResolvedValue({
      found: true,
      data: {
        verificationStatus: 'VERIFIED',
        storeCreatedAt: '2024-01-01T00:00:00.000Z',
        firstSaleAt: '2024-02-01T00:00:00.000Z',
        verifiedSince: '2024-03-01T00:00:00.000Z',
        now: '2025-01-01T00:00:00.000Z',
        windowDays: 90,
        completedInWindow: 12,
        completedLifetime: 20,
        vendorCancelledInWindow: 2,
        deliveries: [{ deliveredAt: new Date('2025-01-03T00:00:00Z'), expectedAt: null, orderDate: new Date('2025-01-01T00:00:00Z') }],
        responseSamples: [{ orderDate: new Date('2025-01-01T00:00:00Z'), firstVendorReplyAt: new Date('2025-01-01T12:00:00Z') }],
        deliveryPolicyDays: 3,
        sellerFaultReturnsInWindow: 0,
        reviewCount: 5,
        reviewSum: 23,
      },
    } as any)
    const ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  it('returns 200 with metrics sourced from the trust profile', async () => {
    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-1' } as any

    const response = await GET(request, { params: { id: 'store-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetCachedSellerTrustProfile).toHaveBeenCalledWith('store-1')
    expect(data.vendor.completedOrders).toBe(12)
    expect(data.vendor.vendorCancelledCount).toBe(2)
    expect(data.vendor.vendorCancellationRate).toBeCloseTo(0.143, 3)
    expect(data.vendor.isNewSeller).toBe(false)
    expect(data.vendor.verifiedPurchaseReviewCount).toBe(5)
    expect(data.vendor.rating).toBe(4.6)
    expect(data.vendor.totalReviews).toBe(5)
  })

  it('returns insufficient-data state when under the minimum-order threshold', async () => {
    mockGetCachedSellerTrustProfile.mockResolvedValue({
      found: true,
      data: {
        verificationStatus: 'UNVERIFIED',
        storeCreatedAt: '2024-01-01T00:00:00.000Z',
        firstSaleAt: null,
        verifiedSince: null,
        now: '2025-01-01T00:00:00.000Z',
        windowDays: 90,
        completedInWindow: 3,
        completedLifetime: 3,
        vendorCancelledInWindow: 1,
        deliveries: [],
        responseSamples: [],
        deliveryPolicyDays: 3,
        sellerFaultReturnsInWindow: 0,
        reviewCount: 0,
        reviewSum: 0,
      },
    } as any)

    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-1' } as any

    const response = await GET(request, { params: { id: 'store-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendor.completedOrders).toBe(3)
    expect(data.vendor.vendorCancelledCount).toBe(1)
    expect(data.vendor.vendorCancellationRate).toBeNull()
    expect(data.vendor.isNewSeller).toBe(true)
    expect(data.vendor.verifiedPurchaseReviewCount).toBe(0)
    expect(data.vendor.rating).toBe(0)
    expect(data.vendor.totalReviews).toBe(0)
  })

  it('returns defaults when the trust profile is not found', async () => {
    mockGetCachedSellerTrustProfile.mockResolvedValue({ found: false } as any)

    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-1' } as any

    const response = await GET(request, { params: { id: 'store-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendor.completedOrders).toBe(0)
    expect(data.vendor.vendorCancelledCount).toBe(0)
    expect(data.vendor.vendorCancellationRate).toBeNull()
    expect(data.vendor.isNewSeller).toBe(false)
    expect(data.vendor.verifiedPurchaseReviewCount).toBe(0)
  })
})
