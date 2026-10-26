import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  returnRequest: { findFirst: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const flagsMock = vi.hoisted(() => ({
  isReturnsFlowEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/feature-flags', () => flagsMock)

import { GET } from '@/app/api/returns/[returnId]/route'

const CUSTOMER = { authenticated: true, userId: 'cust_1', role: 'CUSTOMER', sessionId: 's' }

function buildRequest(cookie: string | null = 'tok'): NextRequest {
  const init: any = { method: 'GET' }
  if (cookie !== null) init.headers = { cookie: `token=${cookie}` }
  return new NextRequest('http://localhost/api/returns/rr_1', init)
}

describe('GET /api/returns/[returnId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    verifyTokenMock.mockResolvedValue(CUSTOMER as any)
    prismaMock.returnRequest.findFirst.mockResolvedValue({
      id: 'rr_1',
      status: 'PENDING',
      customerId: 'cust_1',
    })
  })

  it('returns 404 and makes zero database calls when the flag is unset', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    const res = await GET(buildRequest(), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
    expect(prismaMock.returnRequest.findFirst).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue({ authenticated: false } as any)
    const res = await GET(buildRequest('tok'), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-customer', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'vend_1', role: 'VENDOR', sessionId: 's' } as any)
    const res = await GET(buildRequest('tok'), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(403)
  })

  it('returns 404 when the request belongs to another customer', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    prismaMock.returnRequest.findFirst.mockResolvedValue(null)
    const res = await GET(buildRequest('tok'), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
  })

  it('returns the request when it belongs to the caller', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await GET(buildRequest('tok'), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.returnRequest.id).toBe('rr_1')
    expect(prismaMock.returnRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rr_1', customerId: 'cust_1' } })
    )
  })
})
