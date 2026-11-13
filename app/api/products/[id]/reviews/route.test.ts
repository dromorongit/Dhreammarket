import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}))
vi.mock('@/lib/rating-sync', () => ({
  syncProductRating: vi.fn(),
}))
vi.mock('@/lib/sanitize', () => ({
  sanitizeUserContent: vi.fn((comment: string) => comment),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { rateLimit } from '@/lib/rate-limit'
import { syncProductRating } from '@/lib/rating-sync'
import { sanitizeUserContent } from '@/lib/sanitize'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockRateLimit = vi.mocked(rateLimit)
const mockSyncProductRating = vi.mocked(syncProductRating)
const mockSanitizeUserContent = vi.mocked(sanitizeUserContent)

function buildMockPrisma(overrides: any = {}) {
  const mockPrisma = {
    product: {
      findUnique: vi.fn(async () => (overrides.product === undefined ? { id: 'product-1', store: { userId: 'vendor-1' } } : overrides.product)),
    },
    order: {
      findFirst: vi.fn(async () => (overrides.order === undefined ? { id: 'order-1' } : overrides.order)),
    },
    productReview: {
      findUnique: vi.fn(async () => (overrides.existingReview === undefined ? null : overrides.existingReview)),
      create: vi.fn(async (args: any) => ({ id: 'review-1', ...args.data })),
    },
  }
  return { mockPrisma }
}

const baseRequest = (body: any) => ({
  cookies: { get: () => ({ value: 'token' }) },
  headers: { get: () => null },
  json: async () => body,
}) as any

describe('POST /api/products/[id]/reviews', () => {
  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER' } as any)
    mockRateLimit.mockReturnValue(() => ({ success: true } as any))
    mockSyncProductRating.mockResolvedValue(undefined)
    mockSanitizeUserContent.mockImplementation((comment: string) => comment)
    mockPrisma = buildMockPrisma().mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  const invoke = async (body: any) => {
    const { POST } = await import('@/app/api/products/[id]/reviews/route')
    return POST(baseRequest(body), { params: { id: 'product-1' } })
  }

  it('creates a review and syncs the product rating', async () => {
    const response = await invoke({ rating: 5, comment: 'Great product' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.review.productId).toBe('product-1')
    expect(mockPrisma.productReview.create).toHaveBeenCalled()
    expect(mockSyncProductRating).toHaveBeenCalledWith('product-1')
    expect(mockSanitizeUserContent).toHaveBeenCalledTimes(1)
  })

  it('returns 401 without a token', async () => {
    mockVerifyToken.mockResolvedValue({ authenticated: false } as any)
    const response = await invoke({ rating: 5, comment: 'x' })
    expect(response.status).toBe(401)
  })

  it('returns 403 for non-customers', async () => {
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR' } as any)
    const response = await invoke({ rating: 5, comment: 'x' })
    expect(response.status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue(() => ({
      success: false,
      response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }),
    } as any))
    const response = await invoke({ rating: 5, comment: 'x' })
    expect(response.status).toBe(429)
  })

  it('returns 400 when rating is missing', async () => {
    const response = await invoke({ comment: 'x' })
    expect(response.status).toBe(400)
  })

  it('returns 400 when rating is out of range', async () => {
    const response = await invoke({ rating: 6, comment: 'x' })
    expect(response.status).toBe(400)
  })

  it('returns 404 when the product does not exist', async () => {
    mockPrisma = buildMockPrisma({ product: null }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ rating: 5, comment: 'x' })
    expect(response.status).toBe(404)
  })

  it('returns 400 for a self-review', async () => {
    mockPrisma = buildMockPrisma({ product: { id: 'product-1', store: { userId: 'customer-1' } } }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ rating: 5, comment: 'x' })
    expect(response.status).toBe(400)
  })

  it('returns 403 when the customer has not purchased the product', async () => {
    mockPrisma = buildMockPrisma({ order: null }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ rating: 5, comment: 'x' })
    expect(response.status).toBe(403)
  })

  it('returns 400 when the product was already reviewed', async () => {
    mockPrisma = buildMockPrisma({ existingReview: { id: 'review-0' } }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ rating: 5, comment: 'x' })
    expect(response.status).toBe(400)
  })
})
