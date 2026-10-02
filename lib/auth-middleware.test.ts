import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJwtVerify = vi.fn()
const mockErrors = {
  JWTExpired: class JWTExpired extends Error {},
  JWTInvalid: class JWTInvalid extends Error {},
  JWSSignatureVerificationFailed: class JWSSignatureVerificationFailed extends Error {},
  JWSInvalid: class JWSInvalid extends Error {},
}

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
  errors: mockErrors,
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
const mockGetPrisma = vi.mocked(getPrisma)

describe('auth-middleware verifyToken', () => {
  const mockPrisma = {
    session: {
      findUnique: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  it('returns DB role instead of JWT role', async () => {
    const { verifyToken } = await import('@/lib/auth-middleware')
    const payload = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' }
    mockJwtVerify.mockResolvedValue({ payload })

    mockPrisma.session.findUnique.mockResolvedValue({
      sessionId: 'session-1',
      isExpired: false,
      user: { status: 'ACTIVE', role: 'INFLUENCER' },
    })

    const outcome = await verifyToken('fake-token')
    expect(outcome).toEqual({
      authenticated: true,
      userId: 'user-1',
      role: 'INFLUENCER',
      sessionId: 'session-1',
    })
  })

  it('returns 403 when user is deactivated', async () => {
    const { verifyToken } = await import('@/lib/auth-middleware')
    const payload = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' }
    mockJwtVerify.mockResolvedValue({ payload })

    mockPrisma.session.findUnique.mockResolvedValue({
      sessionId: 'session-1',
      isExpired: false,
      user: { status: 'DISABLED', role: 'ADMIN' },
    })

    const outcome = await verifyToken('fake-token')
    expect(outcome).toEqual({ authenticated: false, reason: 'user_inactive' })
  })

  it('returns 403 when user is banned', async () => {
    const { verifyToken } = await import('@/lib/auth-middleware')
    const payload = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' }
    mockJwtVerify.mockResolvedValue({ payload })

    mockPrisma.session.findUnique.mockResolvedValue({
      sessionId: 'session-1',
      isExpired: false,
      user: { status: 'BANNED', role: 'ADMIN' },
    })

    const outcome = await verifyToken('fake-token')
    expect(outcome).toEqual({ authenticated: false, reason: 'user_inactive' })
  })

  it('returns 403 when user is suspended', async () => {
    const { verifyToken } = await import('@/lib/auth-middleware')
    const payload = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' }
    mockJwtVerify.mockResolvedValue({ payload })

    mockPrisma.session.findUnique.mockResolvedValue({
      sessionId: 'session-1',
      isExpired: false,
      user: { status: 'SUSPENDED', role: 'ADMIN' },
    })

    const outcome = await verifyToken('fake-token')
    expect(outcome).toEqual({ authenticated: false, reason: 'user_inactive' })
  })

  it('returns 403 when session is expired', async () => {
    const { verifyToken } = await import('@/lib/auth-middleware')
    const payload = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' }
    mockJwtVerify.mockResolvedValue({ payload })

    mockPrisma.session.findUnique.mockResolvedValue({
      sessionId: 'session-1',
      isExpired: true,
      user: { status: 'ACTIVE', role: 'ADMIN' },
    })

    const outcome = await verifyToken('fake-token')
    expect(outcome).toEqual({ authenticated: false, reason: 'session_expired' })
  })

  it('returns 403 when session not found', async () => {
    const { verifyToken } = await import('@/lib/auth-middleware')
    const payload = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' }
    mockJwtVerify.mockResolvedValue({ payload })

    mockPrisma.session.findUnique.mockResolvedValue(null)

    const outcome = await verifyToken('fake-token')
    expect(outcome).toEqual({ authenticated: false, reason: 'session_not_found' })
  })

  it('allows ADMIN and SUPER_ADMIN behavior unchanged', async () => {
    const { verifyToken } = await import('@/lib/auth-middleware')
    const payload = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' }
    mockJwtVerify.mockResolvedValue({ payload })

    mockPrisma.session.findUnique.mockResolvedValue({
      sessionId: 'session-1',
      isExpired: false,
      user: { status: 'ACTIVE', role: 'ADMIN' },
    })

    const outcome = await verifyToken('fake-token')
    expect(outcome).toEqual({
      authenticated: true,
      userId: 'user-1',
      role: 'ADMIN',
      sessionId: 'session-1',
    })
  })
})
