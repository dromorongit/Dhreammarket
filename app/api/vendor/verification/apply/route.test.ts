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

function buildMockPrisma(overrides: any = {}) {
  const mockPrisma = {
    store: {
      findUnique: vi.fn(async () => (overrides.store === undefined ? { id: 'store-1', userId: 'vendor-1' } : overrides.store)),
    },
    verificationSetting: {
      findFirst: vi.fn(async () => (overrides.settings === undefined ? {
        verificationFee: 250,
        verificationEnabled: true,
        allowResubmissionAfterRejection: true,
      } : overrides.settings)),
    },
    vendorVerificationApplication: {
      findUnique: vi.fn(async () => (overrides.application === undefined ? null : overrides.application)),
      create: vi.fn(async (args: any) => ({ id: 'app-1', ...args.data })),
      update: vi.fn(async (args: any) => ({ id: 'app-1', ...args.data })),
    },
    verificationAuditLog: {
      create: vi.fn(async () => ({})),
    },
    verificationDocument: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    vendorVerificationKYC: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  }
  return { mockPrisma }
}

const baseRequest = () => ({
  cookies: { get: () => ({ value: 'token' }) },
  headers: { get: () => null },
  json: async () => ({}),
}) as any

describe('POST /api/vendor/verification/apply', () => {
  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR' } as any)
    mockPrisma = buildMockPrisma().mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  const invoke = async () => {
    const { POST } = await import('@/app/api/vendor/verification/apply/route')
    return POST(baseRequest())
  }

  it('creates a verification application', async () => {
    const response = await invoke()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockPrisma.vendorVerificationApplication.create).toHaveBeenCalled()
    expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const { POST } = await import('@/app/api/vendor/verification/apply/route')
    const response = await POST({ cookies: { get: () => undefined }, headers: { get: () => null }, json: async () => ({}) } as any)
    expect(response.status).toBe(401)
  })

  it('returns 404 when the vendor has no store', async () => {
    mockPrisma = buildMockPrisma({ store: null }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke()
    expect(response.status).toBe(404)
  })

  it('returns 400 when verification is disabled', async () => {
    mockPrisma = buildMockPrisma({ settings: { verificationFee: 250, verificationEnabled: false } }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke()
    expect(response.status).toBe(400)
  })

  it('returns 403 when resubmission after rejection is not allowed', async () => {
    mockPrisma = buildMockPrisma({
      application: { status: 'REJECTED' },
      settings: { verificationFee: 250, verificationEnabled: true, allowResubmissionAfterRejection: false },
    }).mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    const response = await invoke()
    expect(response.status).toBe(403)
  })
})
