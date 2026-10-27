import { describe, it, expect, vi, beforeEach } from 'vitest'

const cookiesMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => cookiesMock }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

import { getVendorSession } from './vendor-session'

const VENDOR = { authenticated: true, userId: 'vend_1', role: 'VENDOR', sessionId: 's' }

describe('getVendorSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when there is no token cookie', async () => {
    cookiesMock.get.mockReturnValue(undefined)
    expect(await getVendorSession()).toBeNull()
    expect(verifyTokenMock).not.toHaveBeenCalled()
  })

  it('returns the vendor user id for an authenticated VENDOR', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue(VENDOR)
    expect(await getVendorSession()).toEqual({ userId: 'vend_1' })
  })

  it('returns null when the token is invalid', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue({ authenticated: false })
    expect(await getVendorSession()).toBeNull()
  })

  it('returns null for a non-vendor role', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'cust_1', role: 'CUSTOMER', sessionId: 's' })
    expect(await getVendorSession()).toBeNull()
  })
})
