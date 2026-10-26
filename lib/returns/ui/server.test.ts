import { describe, it, expect, vi, beforeEach } from 'vitest'

const cookiesMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => cookiesMock }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const getPrismaMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ getPrisma: getPrismaMock }))

import { getCustomerSession, requireReturnsFlowEnabled } from './server'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'

vi.mock('@/lib/feature-flags', () => ({
  isReturnsFlowEnabled: vi.fn(() => false),
  getReturnWindowDays: vi.fn(() => 7),
}))

const CUSTOMER = { authenticated: true, userId: 'cust_1', role: 'CUSTOMER', sessionId: 's' }
const VENDOR = { authenticated: true, userId: 'vend_1', role: 'VENDOR', sessionId: 's' }

describe('requireReturnsFlowEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when the flag is unset', () => {
    vi.mocked(isReturnsFlowEnabled).mockReturnValue(false)
    expect(requireReturnsFlowEnabled()).toBe(false)
  })

  it('returns true when the flag is set', () => {
    vi.mocked(isReturnsFlowEnabled).mockReturnValue(true)
    expect(requireReturnsFlowEnabled()).toBe(true)
  })
})

describe('getCustomerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPrismaMock.mockReturnValue({ session: { findUnique: vi.fn() } })
  })

  it('returns null when there is no token cookie', async () => {
    cookiesMock.get.mockReturnValue(undefined)
    expect(await getCustomerSession()).toBeNull()
    expect(verifyTokenMock).not.toHaveBeenCalled()
  })

  it('returns the user id for an authenticated CUSTOMER', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue(CUSTOMER)
    expect(await getCustomerSession()).toEqual({ userId: 'cust_1' })
  })

  it('returns null when the token is invalid', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue({ authenticated: false })
    expect(await getCustomerSession()).toBeNull()
  })

  it('returns null for a non-customer role', async () => {
    cookiesMock.get.mockReturnValue({ value: 'tok' })
    verifyTokenMock.mockResolvedValue(VENDOR)
    expect(await getCustomerSession()).toBeNull()
  })
})
