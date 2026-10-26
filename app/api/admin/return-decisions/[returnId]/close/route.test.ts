import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const requireSuperAdminMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/adminAuth', () => ({ requireSuperAdmin: requireSuperAdminMock }))

const flagsMock = vi.hoisted(() => ({
  isReturnsFlowEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/feature-flags', () => flagsMock)

const closeSettledReturnMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/returns/return-service', () => ({ closeSettledReturn: closeSettledReturnMock }))

import { POST } from '@/app/api/admin/return-decisions/[returnId]/close/route'

const SUPER_ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' }

function buildRequest(body: any = {}): NextRequest {
  const init: any = { method: 'POST', body: JSON.stringify(body) }
  return new NextRequest('http://localhost/api/admin/return-decisions/rr_1/close', init)
}

describe('POST /api/admin/return-decisions/[returnId]/close', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    requireSuperAdminMock.mockResolvedValue(SUPER_ADMIN as any)
    closeSettledReturnMock.mockResolvedValue({ id: 'rr_1', status: 'CLOSED' })
  })

  it('returns 404 and makes zero database calls when the flag is unset', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
    expect(requireSuperAdminMock).not.toHaveBeenCalled()
    expect(closeSettledReturnMock).not.toHaveBeenCalled()
  })

  it('requires super admin and rejects non-admin', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    requireSuperAdminMock.mockResolvedValue(
      new NextResponse('Forbidden', { status: 403 }) as any
    )
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(403)
    expect(closeSettledReturnMock).not.toHaveBeenCalled()
  })

  it('rejects any non-empty request body with 400', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest({ note: 'x' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(400)
    expect(closeSettledReturnMock).not.toHaveBeenCalled()
  })

  it('returns 200 when the return is closed', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    closeSettledReturnMock.mockResolvedValue({ id: 'rr_1', status: 'CLOSED' })
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.noop).toBeUndefined()
    expect(closeSettledReturnMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ returnRequestId: 'rr_1', actorId: 'sa_1' })
    )
  })

  it('returns 200 with a no-op flag when already closed', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    closeSettledReturnMock.mockResolvedValue({ status: 'ALREADY_CLOSED', returnRequestId: 'rr_1' })
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.noop).toBe(true)
  })

  it('returns 409 with refundStatus when the refund is not processed', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    closeSettledReturnMock.mockResolvedValue({ status: 'REFUND_NOT_PROCESSED', refundStatus: 'PENDING' })
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.refundStatus).toBe('PENDING')
  })

  it('returns 409 when no refund is linked', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    closeSettledReturnMock.mockResolvedValue({ status: 'NO_REFUND', returnRequestId: 'rr_1' })
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(409)
  })

  it('returns 404 when the return request is not found', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const notFound = new Error('Return request not found') as any
    notFound.status = 404
    notFound.code = 'NOT_FOUND'
    closeSettledReturnMock.mockRejectedValue(notFound)
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
  })

  it('returns 500 without internal details for unexpected errors', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    closeSettledReturnMock.mockRejectedValue(new Error('boom'))
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to close return')
    expect(json).not.toHaveProperty('message')
    expect(json).not.toHaveProperty('stack')
  })

  it('never exposes personal data in the response', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    closeSettledReturnMock.mockResolvedValue({
      id: 'rr_1',
      status: 'CLOSED',
      customerId: 'cust_1',
      email: 'customer@example.com',
    })
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    const json = await res.json()
    const serialized = JSON.stringify(json)
    expect(serialized).not.toContain('customerId')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('cust_1')
    expect(serialized).not.toContain('customer@example.com')
  })
})
