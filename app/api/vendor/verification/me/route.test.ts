import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)

function buildMockPrisma() {
  const mockPrisma = {
    vendorVerificationApplication: {
      findUnique: vi.fn(async () => application),
    },
  }
  let application: any = {
    id: 'app-1',
    vendorId: 'vendor-1',
    status: 'APPROVED',
    kycInfo: { businessName: 'Biz' },
    documents: [
      { id: 'doc-1', documentType: 'ghana_card_front', documentPath: '/private/verification/card.jpg', fileName: 'card.jpg', createdAt: new Date() },
    ],
    auditLogs: [],
    payments: [],
  }
  return { mockPrisma, setApplication: (a: any) => { application = a } }
}

describe('GET /api/vendor/verification/me', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']
  let setApplication: ReturnType<typeof buildMockPrisma>['setApplication']

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 's-1' } as any)
    const ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    setApplication = ctx.setApplication
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockVerifyToken.mockResolvedValue({ authenticated: false, reason: 'invalid_token' } as any)
    const { GET } = await import('@/app/api/vendor/verification/me/route')
    const request = { url: 'http://localhost/api/vendor/verification/me', cookies: { get: () => undefined } } as any

    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('excludes document paths from the vendor response', async () => {
    const { GET } = await import('@/app/api/vendor/verification/me/route')
    const request = { url: 'http://localhost/api/vendor/verification/me', cookies: { get: () => ({ value: 'token' }) } } as any

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.application.documents).toHaveLength(1)
    expect(data.application.documents[0].id).toBe('doc-1')
    expect(data.application.documents[0].documentType).toBe('ghana_card_front')
    expect(data.application.documents[0].fileName).toBe('card.jpg')
    expect(data.application.documents[0].documentPath).toBeUndefined()
    expect(data.application.documents[0].documentUrl).toBeUndefined()
  })
})
