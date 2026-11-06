import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'

const mockGetPrisma = vi.mocked(getPrisma)
const mockGetCachedSellerTrustProfile = vi.mocked(getCachedSellerTrustProfile)

function buildMockPrisma(store: any) {
  const mockPrisma = {
    store: {
      findUnique: vi.fn(async () => store),
    },
    vendorFollow: {
      count: vi.fn(async () => 0),
    },
  }
  return mockPrisma
}

describe('Vendor API badgeTier visibility', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCachedSellerTrustProfile.mockResolvedValue({ found: false } as any)
  })

  it('omits badgeTier when the store is not verified even if a tier is stored', async () => {
    const store = {
      id: 'store-1',
      slug: 'store-1',
      name: 'Store 1',
      categoryId: 'cat-1',
      isVerified: false,
      isFeatured: false,
      badgeTier: 'PLATINUM',
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
      user: { id: 'u-1', profile: { firstName: 'J', lastName: 'D', avatar: null } },
    }
    mockPrisma = buildMockPrisma(store)
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)

    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-1' } as any

    const response = await GET(request, { params: { id: 'store-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendor.isVerified).toBe(false)
    expect(data.vendor.badgeTier).toBeNull()
  })

  it('includes badgeTier when the store is verified', async () => {
    const store = {
      id: 'store-2',
      slug: 'store-2',
      name: 'Store 2',
      categoryId: 'cat-1',
      isVerified: true,
      isFeatured: false,
      badgeTier: 'PLATINUM',
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
      user: { id: 'u-2', profile: { firstName: 'J', lastName: 'D', avatar: null } },
    }
    mockPrisma = buildMockPrisma(store)
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)

    const { GET } = await import('@/app/api/vendors/[id]/route')
    const request = { url: 'http://localhost/api/vendors/store-2' } as any

    const response = await GET(request, { params: { id: 'store-2' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendor.isVerified).toBe(true)
    expect(data.vendor.badgeTier).toBe('PLATINUM')
  })
})
