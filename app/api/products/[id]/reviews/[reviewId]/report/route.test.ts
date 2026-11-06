import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))
vi.mock('@/lib/sanitize', () => ({
  sanitizeUserContent: vi.fn((comment: string) => comment),
}))
vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sanitizeUserContent } from '@/lib/sanitize'
import { createNotification } from '@/lib/notifications'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockSanitizeUserContent = vi.mocked(sanitizeUserContent)
const mockCreateNotification = vi.mocked(createNotification)

function buildMockPrisma(overrides: any = {}) {
  const mockPrisma = {
    productReview: {
      findUnique: vi.fn(async () => (overrides.review === undefined ? { id: 'review-1', userId: 'customer-1' } : overrides.review)),
    },
    reviewReport: {
      findFirst: vi.fn(async () => (overrides.existingReport === undefined ? null : overrides.existingReport)),
      create: vi.fn(async (args: any) => ({ id: 'report-1', ...args.data })),
    },
    user: {
      findMany: vi.fn(async () => [{ id: 'admin-1' }, { id: 'admin-2' }]),
    },
  }
  return { mockPrisma }
}

const baseRequest = (body: any) => ({
  cookies: { get: () => ({ value: 'token' }) },
  headers: { get: () => null },
  json: async () => body,
}) as any

describe('POST /api/products/[id]/reviews/[reviewId]/report', () => {
  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER' } as any)
    mockSanitizeUserContent.mockImplementation((comment: string) => comment)
    mockCreateNotification.mockResolvedValue(undefined)
    mockPrisma = buildMockPrisma().mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  const invoke = async (body: any) => {
    const { POST } = await import('@/app/api/products/[id]/reviews/[reviewId]/report/route')
    return POST(baseRequest(body), { params: { id: 'product-1', reviewId: 'review-1' } })
  }

  it('creates a report and notifies admins', async () => {
    const response = await invoke({ reason: 'spam', comment: 'not relevant' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.report.reason).toBe('spam')
    expect(mockPrisma.reviewReport.create).toHaveBeenCalled()
    expect(mockCreateNotification).toHaveBeenCalledTimes(2)
    expect(mockSanitizeUserContent).toHaveBeenCalledTimes(1)
  })

  it('returns 401 without a token', async () => {
    mockVerifyToken.mockResolvedValue({ authenticated: false } as any)
    const response = await invoke({ reason: 'spam' })
    expect(response.status).toBe(401)
  })

  it('returns 400 when reason is missing', async () => {
    const response = await invoke({ comment: 'x' })
    expect(response.status).toBe(400)
  })

  it('returns 404 when the review does not exist', async () => {
    mockPrisma = buildMockPrisma({ review: null }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ reason: 'spam' })
    expect(response.status).toBe(404)
  })

  it('returns 400 when the review was already reported by this user', async () => {
    mockPrisma = buildMockPrisma({ existingReport: { id: 'report-0' } }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke({ reason: 'spam' })
    expect(response.status).toBe(400)
  })
})
