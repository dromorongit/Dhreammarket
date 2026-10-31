import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/feature-flags', () => ({
  isTrustProfileEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/trust/cached-profile', () => ({
  getCachedSellerTrustProfile: vi.fn(),
}))

import { isTrustProfileEnabled } from '@/lib/feature-flags'
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'

const flagsMock = isTrustProfileEnabled as unknown as ReturnType<typeof vi.fn>
const cachedMock = getCachedSellerTrustProfile as unknown as ReturnType<typeof vi.fn>

describe('trust seller route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('flag off returns 404 and zero db calls', async () => {
    flagsMock.mockReturnValue(false)
    const { GET } = await import('@/app/api/trust/sellers/[storeId]/route')
    const req = { headers: new Headers() } as any
    const res = await GET(req, { params: { storeId: 'store-1' } })
    expect(res.status).toBe(404)
    expect(cachedMock).not.toHaveBeenCalled()
  })

  it('invalid store id returns 400', async () => {
    flagsMock.mockReturnValue(true)
    const { GET } = await import('@/app/api/trust/sellers/[storeId]/route')
    const req = { headers: new Headers() } as any
    const res = await GET(req, { params: { storeId: 'bad id!' } })
    expect(res.status).toBe(400)
    expect(cachedMock).not.toHaveBeenCalled()
  })

  it('unknown store returns 404', async () => {
    flagsMock.mockReturnValue(true)
    cachedMock.mockResolvedValue({ found: false })
    const { GET } = await import('@/app/api/trust/sellers/[storeId]/route')
    const req = { headers: new Headers() } as any
    const res = await GET(req, { params: { storeId: 'store-1' } })
    expect(res.status).toBe(404)
  })

  it('success shape has no customer/order identifiers', async () => {
    flagsMock.mockReturnValue(true)
    cachedMock.mockResolvedValue({
      found: true,
      data: {
        verificationStatus: 'VERIFIED',
        storeCreatedAt: '2024-01-01T00:00:00.000Z',
        firstSaleAt: '2024-02-01T00:00:00.000Z',
        verifiedSince: '2024-03-01T00:00:00.000Z',
        now: '2025-01-01T00:00:00.000Z',
        windowDays: 90,
        completedInWindow: 10,
        completedLifetime: 20,
        vendorCancelledInWindow: 1,
        deliveryDays: Array(10).fill(2),
        sellerFaultReturnsInWindow: 0,
        reviewCount: 5,
        reviewSum: 25,
      },
    })
    const { GET } = await import('@/app/api/trust/sellers/[storeId]/route')
    const req = { headers: new Headers() } as any
    const res = await GET(req, { params: { storeId: 'store-1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    const serialized = JSON.stringify(body)
    expect(serialized).not.toMatch(/customer|email|phone|orderId|userId/i)
    expect(body.identity.status).toBe('VERIFIED')
    expect(body.orders.completed).toBe(10)
  })
})
