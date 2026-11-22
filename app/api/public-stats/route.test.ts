import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'

const mockGetPrisma = vi.mocked(getPrisma)

function buildMockPrisma(overrides: any = {}) {
  const mockPrisma = {
    user: {
      count: vi.fn(async () => {
        if (overrides.vendorCount !== undefined) return overrides.vendorCount
        if (overrides.happyCustomers !== undefined) return overrides.happyCustomers
        return 10
      }),
    },
    product: {
      count: vi.fn(async () => overrides.productCount ?? 100),
    },
    order: {
      count: vi.fn(async () => overrides.ordersDelivered ?? 50),
    },
  }
  return { mockPrisma }
}

describe('GET /api/public-stats', () => {
  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = buildMockPrisma().mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  const invoke = async () => {
    const { GET } = await import('@/app/api/public-stats/route')
    return GET()
  }

  it('returns real vendor and product counts', async () => {
    mockPrisma = buildMockPrisma({ vendorCount: 25, productCount: 500 }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)

    const response = await invoke()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.vendors).toBe(25)
    expect(data.products).toBe(500)
  })

  it('returns real happy customers count (users with completed orders)', async () => {
    mockPrisma = buildMockPrisma({ happyCustomers: 150 }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)

    const response = await invoke()
    const data = await response.json()

    expect(data.happyCustomers).toBe(150)
    expect(data.happyCustomers).not.toBe(5000) // No hardcoded fallback
  })

  it('returns real orders delivered count', async () => {
    mockPrisma = buildMockPrisma({ ordersDelivered: 75 }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)

    const response = await invoke()
    const data = await response.json()

    expect(data.ordersDelivered).toBe(75)
    expect(data.ordersDelivered).not.toBe(500) // No hardcoded fallback
  })

  it('returns zeros on error', async () => {
    mockPrisma = buildMockPrisma().mockPrisma
    mockPrisma.user.count.mockRejectedValueOnce(new Error('DB error'))
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)

    const response = await invoke()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.vendors).toBe(0)
    expect(data.products).toBe(0)
    expect(data.happyCustomers).toBe(0)
    expect(data.ordersDelivered).toBe(0)
  })
})