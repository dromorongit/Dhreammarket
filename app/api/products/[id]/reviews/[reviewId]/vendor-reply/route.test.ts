import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))
vi.mock('@/lib/sanitize', () => ({
  sanitizeUserContent: vi.fn((message: string) => message),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sanitizeUserContent } from '@/lib/sanitize'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockSanitizeUserContent = vi.mocked(sanitizeUserContent)

function buildMockPrisma(overrides: any = {}) {
  const product = overrides.product ?? { id: 'product-1', storeId: 'store-1' }
  const store = overrides.store ?? { userId: 'vendor-1' }
  const mockPrisma = {
    productReview: {
      findUnique: vi.fn(async () => (overrides.review === undefined ? { id: 'review-1', product } : overrides.review)),
    },
    store: {
      findUnique: vi.fn(async () => (overrides.store === undefined ? { userId: 'vendor-1' } : overrides.store)),
    },
    vendorReply: {
      create: vi.fn(async (args: any) => ({ id: 'reply-1', ...args.data })),
    },
  }
  return { mockPrisma }
}

const baseRequest = (body: any) => ({
  cookies: { get: () => ({ value: 'token' }) },
  headers: { get: () => null },
  json: async () => body,
}) as any

describe('POST /api/products/[id]/reviews/[reviewId]/vendor-reply', () => {
  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR' } as any)
    mockSanitizeUserContent.mockImplementation((message: string) => message)
    mockPrisma = buildMockPrisma().mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  const invoke = async (body: any) => {
    const { POST } = await import('@/app/api/products/[id]/reviews/[reviewId]/vendor-reply/route')
    return POST(baseRequest(body), { params: { id: 'product-1', reviewId: 'review-1' } })
  }

  it('creates a reply for the vendor\'s own product', async () => {
    const response = await invoke({ message: 'Thanks for the review' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.reply.message).toBe('Thanks for the review')
    expect(mockPrisma.vendorReply.create).toHaveBeenCalled()
    expect(mockSanitizeUserContent).toHaveBeenCalledTimes(1)
  })

  it('returns 401 without a token', async () => {
    mockVerifyToken.mockResolvedValue({ authenticated: false } as any)
    const response = await invoke({ message: 'x' })
    expect(response.status).toBe(401)
  })

  it('returns 403 for non-vendors', async () => {
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER' } as any)
    const response = await invoke({ message: 'x' })
    expect(response.status).toBe(403)
  })

  it('returns 404 when the review does not exist', async () => {
    mockPrisma = buildMockPrisma({ review: null }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ message: 'x' })
    expect(response.status).toBe(404)
  })

  it('returns 403 when the reply is for another vendor\'s product', async () => {
    mockPrisma = buildMockPrisma({ store: { userId: 'other-vendor' } }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ message: 'x' })
    expect(response.status).toBe(403)
  })

  it('returns 400 when the message is empty', async () => {
    const response = await invoke({ message: '' })
    expect(response.status).toBe(400)
  })
})
