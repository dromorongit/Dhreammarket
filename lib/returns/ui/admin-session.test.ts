import { describe, it, expect, vi, beforeEach } from 'vitest'

const cookiesMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => cookiesMock }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

import { getSuperAdminSession } from './admin-session'

const SUPER_ADMIN = { authenticated: true, userId: 'sa_1', role: 'SUPER_ADMIN', sessionId: 's' }

describe('getSuperAdminSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when there is no token cookie', async () => {
    cookiesMock.get.mockReturnValue(undefined)
    expect(await getSuperAdminSession()).toBeNull()
    expect(verifyTokenMock).not.toHaveBeenCalled()
  })

  it('returns the super admin user id for an authenticated SUPER_ADMIN', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue(SUPER_ADMIN)
    expect(await getSuperAdminSession()).toEqual({ userId: 'sa_1' })
  })

  it('returns null when the token is invalid', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue({ authenticated: false })
    expect(await getSuperAdminSession()).toBeNull()
  })

  it('returns null for an admin that is not a super admin', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'adm_1', role: 'ADMIN', sessionId: 's' })
    expect(await getSuperAdminSession()).toBeNull()
  })
})
