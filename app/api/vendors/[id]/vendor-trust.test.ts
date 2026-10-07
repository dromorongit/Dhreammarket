import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/trust-metrics', () => ({
  countAttributableVendorCancelledOrders: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { countAttributableVendorCancelledOrders } from '@/lib/trust-metrics'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockCountAttributableVendorCancelledOrders = vi.mocked(countAttributableVendorCancelledOrders)

function buildMockPrisma() {
  const mockPrisma = {
    store: {
      findUnique: vi.fn(async () => ({
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
      })),
    },
    vendorReview: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    vendorFollow: {
      count: vi.fn(async () => 0),
    },
    order: {
      count: vi.fn(async () => 5),
      findMany: vi.fn(async () => []),
    },
    orderItem: {
      findMany: vi.fn(async () => []),
    },
    product: {
      findMany: vi.fn(async () => []),
    },
    productReview: {
      count: vi.fn(async () => 1),
    },
  }

  return { mockPrisma }
}

describe('Vendor trust API', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
    mockCountAttributableVendorCancelledOrders.mockReturnValue(0)
    const ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  it('returns 200 with trust aggregates when all queries succeed', async () => {
    mockCountAttributableVendorCancelledOrders.mockReturnValue(2)

    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-1' } as any

    const response = await GET(request, { params: { id: 'store-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendor.completedOrders).toBe(5)
    expect(data.vendor.vendorCancelledCount).toBe(2)
    expect(data.vendor.isNewSeller).toBe(true)
  })

  it('returns 200 with null rate when attribution throws', async () => {
    mockCountAttributableVendorCancelledOrders.mockImplementation(() => {
      throw new Error('Attribution failed')
    })

    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-1' } as any

    const response = await GET(request, { params: { id: 'store-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendor.vendorCancellationRate).toBeNull()
    expect(data.vendor.isNewSeller).toBe(true)
  })

  it('returns 200 with null rate when completed order count throws', async () => {
    mockPrisma.order.count.mockRejectedValueOnce(new Error('DB error'))

    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-1' } as any

    const response = await GET(request, { params: { id: 'store-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendor.vendorCancellationRate).toBeNull()
    expect(data.vendor.isNewSeller).toBe(true)
  })
})
