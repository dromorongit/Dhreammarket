import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/feature-flags', () => ({
  isTrustProfileEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/trust/load-profile', () => ({
  loadSellerTrustProfile: vi.fn(),
}))

import { isTrustProfileEnabled } from '@/lib/feature-flags'
import { getPrisma } from '@/lib/prisma'
import { loadSellerTrustProfile } from '@/lib/trust/load-profile'

const flagsMock = isTrustProfileEnabled as unknown as ReturnType<typeof vi.fn>
const loadMock = loadSellerTrustProfile as unknown as ReturnType<typeof vi.fn>
const getPrismaMock = getPrisma as unknown as ReturnType<typeof vi.fn>

describe('trust seller route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPrismaMock.mockReturnValue({} as any)
  })

  it('flag off returns 404 and zero db calls', async () => {
    flagsMock.mockReturnValue(false)
    const { GET } = await import('@/app/api/trust/sellers/[storeId]/route')
    const req = { headers: new Headers() } as any
    const res = await GET(req, { params: { storeId: 'store-1' } })
    expect(res.status).toBe(404)
    expect(getPrismaMock).not.toHaveBeenCalled()
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('invalid store id returns 400', async () => {
    flagsMock.mockReturnValue(true)
    const { GET } = await import('@/app/api/trust/sellers/[storeId]/route')
    const req = { headers: new Headers() } as any
    const res = await GET(req, { params: { storeId: 'bad id!' } })
    expect(res.status).toBe(400)
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('unknown store returns 404', async () => {
    flagsMock.mockReturnValue(true)
    loadMock.mockResolvedValue({ found: false })
    const { GET } = await import('@/app/api/trust/sellers/[storeId]/route')
    const req = { headers: new Headers() } as any
    const res = await GET(req, { params: { storeId: 'store-1' } })
    expect(res.status).toBe(404)
  })

  it('success shape has no customer/order identifiers', async () => {
    flagsMock.mockReturnValue(true)
    const now = new Date('2025-01-01T00:00:00Z')
    loadMock.mockResolvedValue({
      found: true,
      data: {
        storeCreatedAt: new Date('2024-01-01T00:00:00Z'),
        firstSaleAt: new Date('2024-02-01T00:00:00Z'),
        verificationStatus: 'VERIFIED',
        verifiedSince: new Date('2024-03-01T00:00:00Z'),
        now,
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
