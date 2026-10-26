import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  returnRequest: { findUnique: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const flagsMock = vi.hoisted(() => ({
  isReturnsFlowEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/feature-flags', () => flagsMock)

const vendorRespondMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/returns/return-service', () => ({ vendorRespond: vendorRespondMock }))

import { POST } from '@/app/api/vendor/returns/[returnId]/respond/route'

const VENDOR_A = { authenticated: true, userId: 'vend_a', role: 'VENDOR', sessionId: 's' }
const VENDOR_B = { authenticated: true, userId: 'vend_b', role: 'VENDOR', sessionId: 's' }

function buildRequest(body: any = null, cookie: string | null = 'tok'): NextRequest {
  const init: any = { method: 'POST' }
  if (body !== null) init.body = JSON.stringify(body)
  if (cookie !== null) init.headers = { cookie: `token=${cookie}` }
  return new NextRequest('http://localhost/api/vendor/returns/rr_1/respond', init)
}

describe('POST /api/vendor/returns/[returnId]/respond', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    verifyTokenMock.mockResolvedValue(VENDOR_A as any)
    prismaMock.returnRequest.findUnique.mockResolvedValue({
      orderItem: { product: { store: { userId: 'vend_a' } } },
    })
    vendorRespondMock.mockResolvedValue({ id: 'rr_1', status: 'AWAITING_REFUND' })
  })

  it('returns 404 and makes zero database calls when the flag is unset', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    const res = await POST(buildRequest({ decision: 'ACCEPT' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
    expect(prismaMock.returnRequest.findUnique).not.toHaveBeenCalled()
    expect(vendorRespondMock).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue({ authenticated: false } as any)
    const res = await POST(buildRequest({ decision: 'ACCEPT' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-vendor', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'cust_1', role: 'CUSTOMER', sessionId: 's' } as any)
    const res = await POST(buildRequest({ decision: 'ACCEPT' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(403)
  })

  it('returns 404 when the request belongs to another store', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    prismaMock.returnRequest.findUnique.mockResolvedValue({
      orderItem: { product: { store: { userId: 'vend_b' } } },
    })
    const res = await POST(buildRequest({ decision: 'ACCEPT' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
  })

  it('rejects unknown body fields', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest({ decision: 'ACCEPT', bogus: 1 }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(400)
  })

  it('returns the updated request on success', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    vendorRespondMock.mockResolvedValue({ id: 'rr_1', status: 'AWAITING_REFUND' })
    const res = await POST(buildRequest({ decision: 'ACCEPT' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.returnRequest.status).toBe('AWAITING_REFUND')
    expect(vendorRespondMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ returnRequestId: 'rr_1', vendorId: 'vend_a' }))
  })
})
